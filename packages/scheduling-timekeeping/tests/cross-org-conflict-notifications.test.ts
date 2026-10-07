import { beforeEach, describe, expect, mock, test } from "bun:test";

const shiftAssignmentTable = {
    workerId: "worker_id",
    shiftId: "shift_id",
    status: "assignment_status",
};

const shiftTable = {
    id: "shift_id",
    organizationId: "organization_id",
    startTime: "start_time",
    endTime: "end_time",
    status: "shift_status",
};

// Conflicts are about the person's app account: the query goes assignment ->
// worker (for worker.userId) -> shift, and answers with user ids.
const workerTable = {
    id: "worker_row_id",
    userId: "worker_user_id",
};

const mockExistingAssignments = mock(() => Promise.resolve<any[]>([]));
const mockSendPushNotification = mock(() => Promise.resolve([{ success: true }]));

mock.module("@repo/database", () => ({
    db: {
        select: mock(() => ({
            from: mock(() => ({
                innerJoin: mock(() => ({
                    innerJoin: mock(() => ({
                        where: mockExistingAssignments,
                    })),
                })),
            })),
        })),
    },
}));

mock.module("@repo/database/schema", () => ({
    shift: shiftTable,
    shiftAssignment: shiftAssignmentTable,
    worker: workerTable,
}));

mock.module("@repo/notifications", () => ({
    sendPushNotification: mockSendPushNotification,
}));

const { notifyWorkersOfCrossOrgConflicts } = await import("../src/modules/time-tracking/cross-org-conflict-notifications");

describe("notifyWorkersOfCrossOrgConflicts", () => {
    beforeEach(() => {
        mockExistingAssignments.mockClear();
        mockSendPushNotification.mockClear();
    });

    test("sends one generic push per worker when a cross-org overlap exists", async () => {
        mockExistingAssignments.mockResolvedValue([
            {
                workerId: "user_1",
                startTime: new Date("2026-06-01T12:00:00.000Z"),
                endTime: new Date("2026-06-01T16:00:00.000Z"),
            },
        ]);

        await notifyWorkersOfCrossOrgConflicts([
            {
                workerId: "user_1",
                shiftId: "shift_new_1",
                startTime: new Date("2026-06-01T13:00:00.000Z"),
                endTime: new Date("2026-06-01T17:00:00.000Z"),
            },
            {
                workerId: "user_1",
                shiftId: "shift_new_2",
                startTime: new Date("2026-06-01T14:00:00.000Z"),
                endTime: new Date("2026-06-01T18:00:00.000Z"),
            },
        ], "org_a");

        expect(mockSendPushNotification).toHaveBeenCalledTimes(1);
        expect(mockSendPushNotification).toHaveBeenCalledWith({
            workerId: "user_1",
            title: "Schedule conflict detected",
            body: "You have overlapping shifts across organizations. Open the app to review and resolve it.",
            data: {
                type: "cross_org_conflict",
                url: "/(tabs)",
            },
        });
    });

    test("does not send pushes when there are no cross-org overlaps", async () => {
        mockExistingAssignments.mockResolvedValue([]);

        await notifyWorkersOfCrossOrgConflicts([
            {
                workerId: "user_2",
                shiftId: "shift_new_3",
                startTime: new Date("2026-06-01T09:00:00.000Z"),
                endTime: new Date("2026-06-01T17:00:00.000Z"),
            },
        ], "org_a");

        expect(mockSendPushNotification).not.toHaveBeenCalled();
    });
});
