import { beforeEach, describe, expect, mock, test } from "bun:test";

const shiftTable = { table: "shift" };
const shiftAssignmentTable = { table: "shift_assignment" };
const scheduledNotificationTable = { table: "scheduled_notification" };
const auditLogTable = { table: "audit_log" };

const updateCalls: Array<{ table: unknown; values: Record<string, unknown> }> = [];

const mockShiftFindFirst = mock(() => Promise.resolve({
    id: "shift_1",
    status: "published",
    title: "Event Server",
    location: { name: "Corcoran Commons" },
    // Pushes go to the app account (worker.userId); someone who has not signed in has none.
    assignments: [
        { status: "active", worker: { userId: "user_1" } },
        { status: "in-progress", worker: { userId: "user_2" } },
        { status: "active", worker: { userId: null } },
        { status: "cancelled", worker: { userId: "user_3" } },
    ],
}));

const mockWhere = mock(() => Promise.resolve([]));
const mockSet = mock((values: Record<string, unknown>) => {
    updateCalls.push({ table: currentTable, values });
    return { where: mockWhere };
});

let currentTable: unknown = null;

const mockUpdate = mock((table: unknown) => {
    currentTable = table;
    return { set: mockSet };
});

const mockSendPushNotification = mock(() => Promise.resolve([{ success: true }]));

mock.module("@repo/database", () => ({
    db: {
        query: {
            shift: { findFirst: mockShiftFindFirst },
        },
        update: mockUpdate,
    },
    eq: (...args: unknown[]) => ({ op: "eq", args }),
    and: (...args: unknown[]) => ({ op: "and", args }),
}));

mock.module("@repo/database/schema", () => ({
    auditLog: auditLogTable,
    shift: shiftTable,
    shiftAssignment: shiftAssignmentTable,
    scheduledNotification: scheduledNotificationTable,
}));

mock.module("@repo/notifications", () => ({
    sendPushNotification: mockSendPushNotification,
}));

describe("cancelShift", () => {
    beforeEach(() => {
        updateCalls.length = 0;
        currentTable = null;
        mockShiftFindFirst.mockClear();
        mockUpdate.mockClear();
        mockSet.mockClear();
        mockWhere.mockClear();
        mockSendPushNotification.mockClear();
    });

    test("marks the shift and assignments cancelled, cancels pending reminders, and notifies the workers who have the app", async () => {
        const { cancelShift } = await import("../src/modules/shifts/cancel");

        const result = await cancelShift("shift_1", "org_1", "admin_1");

        expect(result.success).toBe(true);

        expect(updateCalls).toHaveLength(3);
        expect(updateCalls[0]).toEqual({
            table: shiftTable,
            values: { status: "cancelled" },
        });
        expect(updateCalls[1]).toEqual({
            table: shiftAssignmentTable,
            values: { status: "cancelled" },
        });
        expect(updateCalls[2]?.table).toBe(scheduledNotificationTable);
        expect(updateCalls[2]?.values.status).toBe("cancelled");
        expect(updateCalls[2]?.values.updatedAt).toBeInstanceOf(Date);

        expect(mockSendPushNotification).toHaveBeenCalledTimes(2);
        expect(mockSendPushNotification).toHaveBeenCalledWith({
            workerId: "user_1",
            title: "Shift cancelled",
            body: "Event Server at Corcoran Commons was cancelled. Check the app for the updated schedule.",
            data: {
                type: "shift_cancelled",
                shiftId: "shift_1",
                url: "/(tabs)",
            },
        });
        expect(mockSendPushNotification).toHaveBeenCalledWith({
            workerId: "user_2",
            title: "Shift cancelled",
            body: "Event Server at Corcoran Commons was cancelled. Check the app for the updated schedule.",
            data: {
                type: "shift_cancelled",
                shiftId: "shift_1",
                url: "/(tabs)",
            },
        });
    });
});
