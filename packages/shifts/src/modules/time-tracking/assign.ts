import { db, TxOrDb } from "@repo/database";
import { shift, shiftAssignment } from "@repo/database/schema";
import { eq, and, inArray } from "drizzle-orm";
import { AppError } from "@repo/observability";
import { z } from "zod";
import { OverlapService } from "./overlap";
import { newId } from "../../utils/ids";

const AssignSchema = z.object({
    workerIds: z.array(z.string()).min(1)
});

export const assignWorker = async (body: any, shiftId: string, orgId: string, tx: TxOrDb = db, force: boolean = false) => {
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
    const existingAssignments = await tx.select({ workerId: shiftAssignment.workerId })
        .from(shiftAssignment)
        .where(and(
            eq(shiftAssignment.shiftId, shiftId),
            inArray(shiftAssignment.workerId, workerIds)
        ));

    const alreadyAssignedIds = new Set(existingAssignments.map(a => a.workerId));
    const workersToAssign = workerIds.filter(id => !alreadyAssignedIds.has(id));

    if (workersToAssign.length === 0) {
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

    // 4. Create Assignments
    const values = workersToAssign.map(workerId => ({
        id: newId("asg"),
        shiftId: shiftId,
        workerId: workerId,
        status: 'active' as const,
        budgetRateSnapshot: existingShift.price
    }));

    await tx.insert(shiftAssignment).values(values);

    // TODO: Notify workers

    return {
        success: true,
        message: `Assigned ${values.length} workers`,
        assignedCount: values.length
    };
};
