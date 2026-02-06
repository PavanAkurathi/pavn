import { db } from "@repo/database";
import { shift, shiftAssignment } from "@repo/database/schema";
import { eq, and, inArray } from "drizzle-orm";
import { AppError } from "@repo/observability";
import { z } from "zod";
import { OverlapService } from "../services/overlap";
import { newId } from "../utils/ids";

const AssignSchema = z.object({
    workerIds: z.array(z.string()).min(1)
});

export const assignWorkerController = async (req: Request, shiftId: string, orgId: string): Promise<Response> => {
    const body = await req.json();
    const parseResult = AssignSchema.safeParse(body);

    if (!parseResult.success) {
        throw new AppError("Validation Failed", "VALIDATION_ERROR", 400, parseResult.error.flatten());
    }

    const { workerIds } = parseResult.data;

    // 1. Verify Shift Exists & Ownership
    const existingShift = await db.query.shift.findFirst({
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
    const existingAssignments = await db.select({ workerId: shiftAssignment.workerId })
        .from(shiftAssignment)
        .where(and(
            eq(shiftAssignment.shiftId, shiftId),
            inArray(shiftAssignment.workerId, workerIds)
        ));

    const alreadyAssignedIds = new Set(existingAssignments.map(a => a.workerId));
    const workersToAssign = workerIds.filter(id => !alreadyAssignedIds.has(id));

    if (workersToAssign.length === 0) {
        return Response.json({ success: true, message: "All workers already assigned" });
    }

    // 3. Check for Overlaps (Privacy Safe)
    for (const workerId of workersToAssign) {
        const result = await OverlapService.findOverlappingAssignment(
            workerId,
            existingShift.startTime,
            existingShift.endTime
        );

        if (result.conflict) {
            throw new AppError(
                `Worker ${workerId} is unavailable: ${result.message || 'Time conflict'}`,
                "OVERLAP_CONFLICT",
                409
            );
        }
    }

    // 4. Create Assignments
    const values = workersToAssign.map(workerId => ({
        id: newId("asg"),
        shiftId: shiftId,
        workerId: workerId,
        status: 'active' as const,
        hourlyRateSnapshot: existingShift.price
    }));

    await db.insert(shiftAssignment).values(values);

    // TODO: Notify workers

    return Response.json({
        success: true,
        message: `Assigned ${values.length} workers`,
        assignedCount: values.length
    });
};
