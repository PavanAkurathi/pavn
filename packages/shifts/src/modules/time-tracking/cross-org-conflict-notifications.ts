import { db } from "@repo/database";
import { shift, shiftAssignment } from "@repo/database/schema";
import { and, eq, gt, inArray, lt, ne } from "drizzle-orm";
import { sendPushNotification } from "@repo/notifications";

type PlannedAssignment = {
    workerId: string;
    shiftId: string;
    startTime: Date;
    endTime: Date;
};

const ACTIVE_ASSIGNMENT_STATUSES = ["active", "assigned", "in-progress"] as const;
const ACTIVE_SHIFT_STATUSES = ["published", "assigned", "in-progress"] as const;

export async function notifyWorkersOfCrossOrgConflicts(
    plannedAssignments: PlannedAssignment[],
    activeOrgId: string
): Promise<void> {
    const uniquePlannedAssignments = plannedAssignments.filter((assignment): assignment is PlannedAssignment => {
        return Boolean(assignment.workerId && assignment.shiftId);
    });

    if (uniquePlannedAssignments.length === 0) {
        return;
    }

    const workerIds = Array.from(new Set(uniquePlannedAssignments.map(assignment => assignment.workerId)));
    const searchStart = new Date(Math.min(...uniquePlannedAssignments.map(assignment => assignment.startTime.getTime())));
    const searchEnd = new Date(Math.max(...uniquePlannedAssignments.map(assignment => assignment.endTime.getTime())));

    const existingAssignments = await db.select({
        workerId: shiftAssignment.workerId,
        startTime: shift.startTime,
        endTime: shift.endTime,
    })
        .from(shiftAssignment)
        .innerJoin(shift, eq(shiftAssignment.shiftId, shift.id))
        .where(and(
            inArray(shiftAssignment.workerId, workerIds),
            inArray(shiftAssignment.status, ACTIVE_ASSIGNMENT_STATUSES as unknown as string[]),
            inArray(shift.status, ACTIVE_SHIFT_STATUSES as unknown as string[]),
            ne(shift.organizationId, activeOrgId),
            lt(shift.startTime, searchEnd),
            gt(shift.endTime, searchStart)
        ));

    const conflictingWorkers = new Set<string>();

    for (const plannedAssignment of uniquePlannedAssignments) {
        const hasCrossOrgOverlap = existingAssignments.some(existingAssignment => {
            return (
                existingAssignment.workerId === plannedAssignment.workerId &&
                existingAssignment.startTime < plannedAssignment.endTime &&
                existingAssignment.endTime > plannedAssignment.startTime
            );
        });

        if (hasCrossOrgOverlap) {
            conflictingWorkers.add(plannedAssignment.workerId);
        }
    }

    if (conflictingWorkers.size === 0) {
        return;
    }

    const pushPayload = {
        title: "Schedule conflict detected",
        body: "You have overlapping shifts across organizations. Open the app to review and resolve it.",
        data: {
            type: "cross_org_conflict",
            url: "/(tabs)",
        },
    };

    await Promise.allSettled(
        Array.from(conflictingWorkers).map(workerId =>
            sendPushNotification({
                workerId,
                ...pushPayload,
            })
        )
    );
}
