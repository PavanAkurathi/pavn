import { describe, test, expect, mock, beforeEach } from "bun:test";

let assignmentRow: Record<string, unknown>;
const auditRows: Record<string, unknown>[] = [];
let assignmentUpdate: Record<string, unknown> = {};

const SHIFT_START = new Date("2026-08-20T13:00:00Z");

const tx = {
    query: {
        shiftAssignment: { findFirst: mock(() => Promise.resolve(assignmentRow)) },
        shift: {
            findFirst: mock(() => Promise.resolve({ startTime: SHIFT_START, status: "completed" })),
        },
    },
    update: () => ({
        set: (values: Record<string, unknown>) => {
            assignmentUpdate = values;
            return { where: () => Promise.resolve() };
        },
    }),
    insert: () => ({
        values: (row: Record<string, unknown>) => {
            auditRows.push(row);
            return Promise.resolve();
        },
    }),
};

mock.module("@repo/database", () => ({
    db: { transaction: async (fn: (t: unknown) => Promise<unknown>) => fn(tx) },
}));

const { applyManagerTimesheetUpdate } = await import(
    "../src/modules/time-tracking/assignment-admin"
);

const ORG = "org_1";
const MANAGER = "user_manager";

describe("manager edits to a timesheet", () => {
    beforeEach(() => {
        auditRows.length = 0;
        assignmentUpdate = {};
        assignmentRow = {
            id: "asg_1",
            status: "completed",
            actualClockIn: new Date("2026-08-20T13:00:00Z"),
            actualClockOut: new Date("2026-08-20T21:00:00Z"),
            breakMinutes: 30,
        };
    });

    test("records the change even when the status does not move", async () => {
        // Correcting 9:00 to 8:30 on an already-completed shift. The status stays
        // "completed" throughout — the case that previously left no trace at all.
        await applyManagerTimesheetUpdate(
            MANAGER,
            ORG,
            "shf_1",
            "worker_1",
            { clockIn: new Date("2026-08-20T12:30:00Z") },
            "manager",
        );

        expect(auditRows).toHaveLength(1);
        const meta = auditRows[0]!.metadata as Record<string, unknown>;
        expect(meta.action).toBe("manager_override");
        expect(meta.previousClockIn).toBe("2026-08-20T13:00:00.000Z");
        expect(meta.clockIn).toBe("2026-08-20T12:30:00.000Z");
        expect(auditRows[0]!.actorId).toBe(MANAGER);
    });

    test("a time the manager typed is not marked as verified by the geofence", async () => {
        await applyManagerTimesheetUpdate(
            MANAGER,
            ORG,
            "shf_1",
            "worker_1",
            { clockIn: new Date("2026-08-20T12:30:00Z") },
            "manager",
        );

        expect(assignmentUpdate.clockInMethod).toBe("manual_override");
        expect(assignmentUpdate.clockInVerified).toBe(false);
        // Untouched, so its provenance is left alone.
        expect(assignmentUpdate.clockOutMethod).toBeUndefined();
    });

    test("stamps who adjusted it and when", async () => {
        await applyManagerTimesheetUpdate(
            MANAGER,
            ORG,
            "shf_1",
            "worker_1",
            { breakMinutes: 60 },
            "manager",
        );

        expect(assignmentUpdate.adjustedBy).toBe(MANAGER);
        expect(assignmentUpdate.adjustedAt).toBeInstanceOf(Date);
    });

    test("carries both sides of a break change", async () => {
        await applyManagerTimesheetUpdate(
            MANAGER,
            ORG,
            "shf_1",
            "worker_1",
            { breakMinutes: 60 },
            "manager",
        );

        const meta = auditRows[0]!.metadata as Record<string, unknown>;
        expect(meta.previousBreakMinutes).toBe(30);
        expect(meta.breakMinutes).toBe(60);
    });

    test("writes nothing when nothing actually changed", async () => {
        await applyManagerTimesheetUpdate(
            MANAGER,
            ORG,
            "shf_1",
            "worker_1",
            { breakMinutes: 30 },
            "manager",
        );

        expect(auditRows).toHaveLength(0);
    });

    test("a worker's own submission is not labelled a manager override", async () => {
        await applyManagerTimesheetUpdate(
            "worker_1",
            ORG,
            "shf_1",
            "worker_1",
            { breakMinutes: 45 },
            "member",
        );

        expect((auditRows[0]!.metadata as Record<string, unknown>).action).toBe("timesheet_update");
        expect(assignmentUpdate.adjustedBy).toBeUndefined();
    });
});
