import { describe, test, expect, mock, beforeEach } from "bun:test";

let shiftRow: Record<string, unknown> | undefined;
let locationRow: Record<string, unknown> | undefined;
let activeAssignments: unknown[] = [];
let updateSet: Record<string, unknown> = {};
let insertedNotifications: unknown[] = [];
let deletedPendingNotifications = 0;

const mockDb = {
    query: {
        shift: { findFirst: mock(() => Promise.resolve(shiftRow)) },
        location: { findFirst: mock(() => Promise.resolve(locationRow)) },
        shiftAssignment: { findMany: mock(() => Promise.resolve(activeAssignments)) },
    },
    update: () => ({
        set: (values: Record<string, unknown>) => {
            updateSet = values;
            return { where: () => ({ returning: () => Promise.resolve([{ id: "shf_1", ...values }]) }) };
        },
    }),
    insert: () => ({
        values: (rows: unknown[]) => {
            insertedNotifications.push(...(Array.isArray(rows) ? rows : [rows]));
            return Promise.resolve();
        },
    }),
    delete: () => ({
        where: () => {
            deletedPendingNotifications += 1;
            return Promise.resolve();
        },
    }),
};

mock.module("@repo/database", () => ({ db: mockDb, logAudit: mock(() => Promise.resolve()) }));
mock.module("@repo/notifications", () => ({
    buildNotificationSchedule: mock(async (workerId: string) => [{ id: `n_${workerId}`, workerId }]),
}));

const { editShift } = await import("../src/modules/shifts/edit-shift");

const ORG = "org_1";
const MANAGER = "user_manager";

describe("editShift", () => {
    beforeEach(() => {
        updateSet = {};
        insertedNotifications = [];
        deletedPendingNotifications = 0;
        activeAssignments = [];
        locationRow = { id: "loc_1", name: "Boston Yard", timezone: "America/New_York" };
        shiftRow = {
            id: "shf_1",
            organizationId: ORG,
            locationId: "loc_1",
            title: "Loader",
            status: "published",
            timezone: "America/New_York",
            startTime: new Date("2026-08-20T13:00:00Z"), // 09:00 EDT
            endTime: new Date("2026-08-20T21:00:00Z"),
        };
    });

    test("places wall-clock times using the shift's timezone, not the caller's", async () => {
        await editShift("shf_1", ORG, MANAGER, {
            local: { date: "2026-08-20", startTime: "08:30", endTime: "17:00" },
        });

        // 08:30 in New York on 20 Aug 2026 is 12:30 UTC.
        expect((updateSet.startTime as Date).toISOString()).toBe("2026-08-20T12:30:00.000Z");
        expect((updateSet.endTime as Date).toISOString()).toBe("2026-08-20T21:00:00.000Z");
    });

    test("carries an overnight edit into the next day", async () => {
        await editShift("shf_1", ORG, MANAGER, {
            local: { date: "2026-08-20", startTime: "22:00", endTime: "06:00" },
        });

        expect((updateSet.startTime as Date).toISOString()).toBe("2026-08-21T02:00:00.000Z");
        expect((updateSet.endTime as Date).toISOString()).toBe("2026-08-21T10:00:00.000Z");
    });

    test("moving a shift to another location moves its clock with it", async () => {
        locationRow = { id: "loc_phx", name: "Phoenix Depot", timezone: "America/Phoenix" };

        await editShift("shf_1", ORG, MANAGER, {
            locationId: "loc_phx",
            local: { date: "2026-08-20", startTime: "09:00", endTime: "17:00" },
        });

        expect(updateSet.timezone).toBe("America/Phoenix");
        // Arizona does not observe DST, so 09:00 there is 16:00 UTC.
        expect((updateSet.startTime as Date).toISOString()).toBe("2026-08-20T16:00:00.000Z");
    });

    test("re-notifies the app users on a published shift when the time moves", async () => {
        activeAssignments = [
            { workerId: "user_1" },
            { workerId: "user_2" },
            { workerId: null }, // invited or agency — no device to reach
        ];

        const result = await editShift("shf_1", ORG, MANAGER, {
            local: { date: "2026-08-20", startTime: "06:00", endTime: "14:00" },
        });

        expect(result.timeChanged).toBe(true);
        expect(result.notified).toBe(2);
        expect(result.unreachable).toBe(1);
        // The stale reminders point at an hour this shift no longer starts.
        expect(deletedPendingNotifications).toBe(1);
        expect(insertedNotifications).toHaveLength(2);
    });

    test("says nothing to anyone when only the title changes", async () => {
        activeAssignments = [{ workerId: "user_1" }];

        const result = await editShift("shf_1", ORG, MANAGER, { title: "Forklift Operator" });

        expect(result.timeChanged).toBe(false);
        expect(result.notified).toBe(0);
        expect(insertedNotifications).toHaveLength(0);
    });

    test("a draft moving about disturbs nobody", async () => {
        shiftRow = { ...shiftRow, status: "draft" };
        activeAssignments = [{ workerId: "user_1" }];

        const result = await editShift("shf_1", ORG, MANAGER, {
            local: { date: "2026-08-21", startTime: "09:00", endTime: "17:00" },
        });

        expect(result.timeChanged).toBe(true);
        expect(result.notified).toBe(0);
        expect(insertedNotifications).toHaveLength(0);
    });

    test("refuses to end before it starts", async () => {
        await expect(
            editShift("shf_1", ORG, MANAGER, { endTime: "2026-08-20T12:00:00.000Z" }),
        ).rejects.toThrow(/End time must be after start time/);
    });

    test("refuses to cut capacity below the people already on it", async () => {
        activeAssignments = [{ workerId: "a" }, { workerId: "b" }, { workerId: "c" }];

        await expect(editShift("shf_1", ORG, MANAGER, { capacityTotal: 2 })).rejects.toThrow(
            /Cannot reduce capacity/,
        );
    });

    test("will not edit a shift that is already finished", async () => {
        shiftRow = { ...shiftRow, status: "approved" };

        await expect(editShift("shf_1", ORG, MANAGER, { title: "Nope" })).rejects.toThrow(
            /Cannot edit shift/,
        );
    });

    test("404s for a shift belonging to another org", async () => {
        shiftRow = undefined;

        await expect(editShift("shf_other", ORG, MANAGER, { title: "Nope" })).rejects.toThrow(
            /Shift not found/,
        );
    });
});
