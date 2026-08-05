import { db, TxOrDb } from "@repo/database";
import { rosterEntry, shift, shiftAssignment, tempWorker } from "@repo/database/schema";
import { eq, and, inArray, isNotNull } from "drizzle-orm";
import { AppError } from "@repo/observability";
import { z } from "zod";
import { OverlapService } from "./overlap";
import { newId } from "../../utils/ids";
import { notifyWorkersOfCrossOrgConflicts } from "./cross-org-conflict-notifications";

const AssignSchema = z
    .object({
        workerIds: z.array(z.string()).default([]),
        tempWorkerIds: z.array(z.string()).default([]),
        rosterEntryIds: z.array(z.string()).default([]),
    })
    .refine((value) => value.workerIds.length + value.tempWorkerIds.length + value.rosterEntryIds.length > 0, {
        error: "Provide at least one worker",
    });

export const assignWorker = async (body: any, shiftId: string, orgId: string, tx: TxOrDb = db, force: boolean = false) => {
    const parseResult = AssignSchema.safeParse(body);

    if (!parseResult.success) {
        throw new AppError("Validation Failed", "VALIDATION_ERROR", 400, parseResult.error.flatten());
    }

    const { workerIds, tempWorkerIds, rosterEntryIds } = parseResult.data;

    // 1. Verify Shift Exists & Ownership
    const existingShift = await tx.query.shift.findFirst({
        where: and(eq(shift.id, shiftId), eq(shift.organizationId, orgId)),
        columns: {
            id: true,
            status: true,
            startTime: true,
            endTime: true,
            title: true,
            price: true
        }
    });

    if (!existingShift) {
        throw new AppError("Shift not found", "NOT_FOUND", 404);
    }

    if (['cancelled', 'completed'].includes(existingShift.status)) {
        throw new AppError(`Cannot assign workers to a ${existingShift.status} shift`, "INVALID_STATE", 400);
    }

    // 2. Check for existing assignments (to avoid duplicates)
    const existingAssignments = workerIds.length > 0
        ? await tx.select({ workerId: shiftAssignment.workerId })
            .from(shiftAssignment)
            .where(and(
                eq(shiftAssignment.shiftId, shiftId),
                inArray(shiftAssignment.workerId, workerIds)
            ))
        : [];

    const alreadyAssignedIds = new Set(existingAssignments.map(a => a.workerId));
    const workersToAssign = workerIds.filter(id => !alreadyAssignedIds.has(id));

    // Temps: verify org ownership, then dedupe against existing assignments.
    let tempsToAssign: string[] = [];
    if (tempWorkerIds.length > 0) {
        const ownedTemps = await tx.select({ id: tempWorker.id })
            .from(tempWorker)
            .where(and(
                eq(tempWorker.organizationId, orgId),
                inArray(tempWorker.id, tempWorkerIds)
            ));
        const ownedIds = new Set(ownedTemps.map(t => t.id));

        const existingTempAssignments = await tx.select({ tempWorkerId: shiftAssignment.tempWorkerId })
            .from(shiftAssignment)
            .where(and(
                eq(shiftAssignment.shiftId, shiftId),
                isNotNull(shiftAssignment.tempWorkerId),
                inArray(shiftAssignment.tempWorkerId, tempWorkerIds)
            ));
        const alreadyAssignedTempIds = new Set(existingTempAssignments.map(a => a.tempWorkerId));

        tempsToAssign = tempWorkerIds.filter(id => ownedIds.has(id) && !alreadyAssignedTempIds.has(id));
    }

    // Invited in-house workers (roster entries): verify ownership, dedupe.
    let rosterEntriesToAssign: string[] = [];
    if (rosterEntryIds.length > 0) {
        const ownedEntries = await tx.select({ id: rosterEntry.id })
            .from(rosterEntry)
            .where(and(
                eq(rosterEntry.organizationId, orgId),
                inArray(rosterEntry.id, rosterEntryIds)
            ));
        const ownedEntryIds = new Set(ownedEntries.map(e => e.id));

        const existingEntryAssignments = await tx.select({ rosterEntryId: shiftAssignment.rosterEntryId })
            .from(shiftAssignment)
            .where(and(
                eq(shiftAssignment.shiftId, shiftId),
                isNotNull(shiftAssignment.rosterEntryId),
                inArray(shiftAssignment.rosterEntryId, rosterEntryIds)
            ));
        const alreadyAssignedEntryIds = new Set(existingEntryAssignments.map(a => a.rosterEntryId));

        rosterEntriesToAssign = rosterEntryIds.filter(id => ownedEntryIds.has(id) && !alreadyAssignedEntryIds.has(id));
    }

    if (workersToAssign.length === 0 && tempsToAssign.length === 0 && rosterEntriesToAssign.length === 0) {
        return { success: true, message: "All workers already assigned" };
    }

    // 3. Check for Overlaps (Privacy Safe)
    const warnings: Array<{ workerId: string; type: string; message: string }> = [];
    for (const workerId of workersToAssign) {
        const result = await OverlapService.findOverlappingAssignment(
            workerId,
            existingShift.startTime,
            existingShift.endTime,
            orgId
        );

        if (result.conflict) {
            if (result.type === 'unavailable') {
                // Hard block — worker marked themselves unavailable
                throw new AppError(
                    `Worker ${workerId} is unavailable: ${result.message || 'Marked unavailable'}`,
                    "OVERLAP_CONFLICT",
                    409
                );
            }
            // Intra-org overlap — warn but allow with force
            if (!force) {
                warnings.push({
                    workerId,
                    type: result.type || 'internal_conflict',
                    message: result.message || 'Worker has overlapping shift in this org',
                });
            }
        }
    }

    // If warnings and not forced, return warning response (not error)
    if (warnings.length > 0 && !force) {
        return {
            success: false,
            warning: true,
            conflicts: warnings,
            message: "Workers have overlapping shifts. Resend with force=true to override.",
        };
    }

    // 4. Create Assignments (roster workers + temps; overlap/notification
    // checks don't apply to temps — they have no app account or availability)
    const values = [
        ...workersToAssign.map(workerId => ({
            id: newId("asg"),
            shiftId: shiftId,
            workerId: workerId,
            status: 'active' as const,
            budgetRateSnapshot: null
        })),
        ...tempsToAssign.map(tempWorkerId => ({
            id: newId("asg"),
            shiftId: shiftId,
            tempWorkerId,
            status: 'active' as const,
            budgetRateSnapshot: null
        })),
        ...rosterEntriesToAssign.map(entryId => ({
            id: newId("asg"),
            shiftId: shiftId,
            rosterEntryId: entryId,
            status: 'active' as const,
            budgetRateSnapshot: null
        })),
    ];

    await tx.insert(shiftAssignment).values(values);

    await notifyWorkersOfCrossOrgConflicts(
        workersToAssign.map(workerId => ({
            workerId,
            shiftId,
            startTime: existingShift.startTime,
            endTime: existingShift.endTime,
        })),
        orgId
    );

    return {
        success: true,
        message: `Assigned ${values.length} workers`,
        assignedCount: values.length,
        tempCount: tempsToAssign.length
    };
};
