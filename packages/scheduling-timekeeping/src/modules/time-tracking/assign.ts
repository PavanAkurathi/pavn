import { db, TxOrDb, logAudit } from "@repo/database";
import { shift, shiftAssignment, worker } from "@repo/database/schema";
import { eq, and, inArray } from "drizzle-orm";
import { AppError } from "@repo/observability";
import { z } from "zod";
import { OverlapService } from "./overlap";
import { newId } from "../../utils/ids";
import { notifyWorkersOfCrossOrgConflicts } from "./cross-org-conflict-notifications";

const AssignSchema = z.object({
    workerIds: z.array(z.string()).min(1, { error: "Provide at least one worker" }),
});

export const assignWorker = async (
    body: any,
    shiftId: string,
    orgId: string,
    tx: TxOrDb = db,
    force: boolean = false,
    /** Who is doing it — recorded when they override a limit. */
    actorId?: string,
) => {
    const parseResult = AssignSchema.safeParse(body);

    if (!parseResult.success) {
        throw new AppError("Validation Failed", "VALIDATION_ERROR", 400, parseResult.error.flatten());
    }

    const { workerIds } = parseResult.data;

    // 1. Verify Shift Exists & Ownership
    const existingShift = await tx.query.shift.findFirst({
        where: and(eq(shift.id, shiftId), eq(shift.organizationId, orgId)),
        columns: {
            id: true,
            status: true,
            startTime: true,
            endTime: true,
            title: true,
            price: true,
            capacityTotal: true
        }
    });

    if (!existingShift) {
        throw new AppError("Shift not found", "NOT_FOUND", 404);
    }

    if (['cancelled', 'completed'].includes(existingShift.status)) {
        throw new AppError(`Cannot assign workers to a ${existingShift.status} shift`, "INVALID_STATE", 400);
    }

    // 2. Only the business's own workers can be assigned, and nobody twice.
    const ownedWorkers = await tx.select({
            id: worker.id,
            userId: worker.userId,
            status: worker.status,
        })
        .from(worker)
        .where(and(
            eq(worker.organizationId, orgId),
            inArray(worker.id, workerIds)
        ));

    const ownedIds = new Set(ownedWorkers.map((w) => w.id));
    if (workerIds.some((id) => !ownedIds.has(id))) {
        throw new AppError("Worker not found", "NOT_FOUND", 404);
    }

    const inactive = ownedWorkers.find((w) => w.status === "inactive");
    if (inactive) {
        throw new AppError("This worker is inactive. Reactivate them to schedule them.", "INVALID_STATE", 409);
    }

    const assignable = ownedWorkers;
    const assignableIds = ownedIds;

    const existingAssignments = await tx.select({ workerId: shiftAssignment.workerId })
        .from(shiftAssignment)
        .where(and(
            eq(shiftAssignment.shiftId, shiftId),
            inArray(shiftAssignment.workerId, workerIds)
        ));

    const alreadyAssignedIds = new Set(existingAssignments.map(a => a.workerId));
    const workersToAssign = workerIds.filter(id => assignableIds.has(id) && !alreadyAssignedIds.has(id));

    if (workersToAssign.length === 0) {
        return { success: true, message: "All workers already assigned" };
    }

    // 3. Check capacity.
    //
    // A soft gate, deliberately. A manager who needs a thirty-first body on a
    // thirty-slot shift usually has a reason, and blocking them outright just
    // gets worked around by editing the headcount first. So it asks, allows the
    // override, and records it — the same shape as the overlap check below.
    const incomingCount = workersToAssign.length;
    const capacityTotal = existingShift.capacityTotal ?? 0;

    const activeNow = await tx.select({ id: shiftAssignment.id })
        .from(shiftAssignment)
        .where(and(
            eq(shiftAssignment.shiftId, shiftId),
            eq(shiftAssignment.status, "active"),
        ));

    const filledAfter = activeNow.length + incomingCount;
    const overBy = capacityTotal > 0 ? filledAfter - capacityTotal : 0;

    if (overBy > 0 && !force) {
        return {
            success: false,
            warning: true,
            capacityConflict: {
                capacityTotal,
                filled: activeNow.length,
                adding: incomingCount,
                overBy,
            },
            message: `This shift has ${capacityTotal} slot${capacityTotal === 1 ? "" : "s"} and ${activeNow.length} filled. Adding ${incomingCount} puts it ${overBy} over.`,
        };
    }

    // 4. Check for Overlaps (Privacy Safe)
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

    // 4. Create Assignments
    const values = workersToAssign.map(workerId => ({
        id: newId("asg"),
        shiftId: shiftId,
        workerId,
        status: 'active' as const,
        budgetRateSnapshot: null
    }));

    await tx.insert(shiftAssignment).values(values);

    // Overstaffing on purpose is allowed, but it does not go unrecorded — the
    // shift shows "Over capacity" and this is the reason behind it.
    if (overBy > 0) {
        await logAudit({
            action: "shift.capacity_override",
            entityType: "shift",
            entityId: shiftId,
            actorId: actorId ?? "system",
            organizationId: orgId,
            metadata: {
                capacityTotal,
                filledBefore: activeNow.length,
                added: incomingCount,
                overBy,
            },
        });
    }

    // Cross-business conflicts are about a person's app account, so only
    // workers who have signed in can have one.
    const userIdByWorker = new Map(assignable.map((w) => [w.id, w.userId] as const));
    await notifyWorkersOfCrossOrgConflicts(
        workersToAssign.flatMap(workerId => {
            const userId = userIdByWorker.get(workerId);
            return userId
                ? [{
                    workerId: userId,
                    shiftId,
                    startTime: existingShift.startTime,
                    endTime: existingShift.endTime,
                }]
                : [];
        }),
        orgId
    );

    return {
        success: true,
        message: `Assigned ${values.length} workers`,
        assignedCount: values.length,
    };
};
