import { describe, test, expect, mock, beforeEach } from "bun:test";

let shiftRow: Record<string, unknown> | undefined;
let activeAssignments: unknown[] = [];
/** Workers the business owns; assign() refuses ids that are not in this list. */
let ownedWorkerIds: string[] = [];
let insertedAssignments: unknown[] = [];
let auditEntries: Record<string, unknown>[] = [];

/**
 * assign() runs several selects. Three shapes matter here: the ownership check
 * asks for the worker's `userId` and `status`, the dedupe probe asks for a
 * specific column, and the capacity count asks for `id` off the assignment
 * table. Discriminating on the requested columns keeps the real schema in play
 * — mocking the schema module wholesale breaks everything else that imports
 * from it.
 */
const mockDb = {
    query: { shift: { findFirst: mock(() => Promise.resolve(shiftRow)) } },
    select: (cols?: Record<string, unknown>) => ({
        from: () => ({
            where: () => {
                if (cols && "userId" in cols) {
                    return Promise.resolve(ownedWorkerIds.map((id) => ({ id, userId: null, status: "active" })));
                }
                return Promise.resolve(cols && "id" in cols && Object.keys(cols).length === 1 ? activeAssignments : []);
            },
        }),
    }),
    insert: () => ({
        values: (rows: unknown[]) => {
            insertedAssignments.push(...rows);
            return Promise.resolve();
        },
    }),
};

mock.module("@repo/database", () => ({
    db: mockDb,
    logAudit: mock(async (entry: Record<string, unknown>) => {
        auditEntries.push(entry);
    }),
}));

mock.module("../src/modules/time-tracking/overlap", () => ({
    OverlapService: { findOverlappingAssignment: mock(async () => ({ conflict: false })) },
}));

mock.module("../src/modules/time-tracking/cross-org-conflict-notifications", () => ({
    notifyWorkersOfCrossOrgConflicts: mock(async () => undefined),
}));

const { assignWorker } = await import("../src/modules/time-tracking/assign");

const ORG = "org_1";

describe("assigning past capacity", () => {
    beforeEach(() => {
        insertedAssignments = [];
        auditEntries = [];
        activeAssignments = [];
        ownedWorkerIds = ["wkr_new", "wkr_a", "wkr_b", "wkr_c"];
        shiftRow = {
            id: "shf_1",
            status: "published",
            title: "Loader",
            price: 0,
            capacityTotal: 3,
            startTime: new Date("2026-08-20T13:00:00Z"),
            endTime: new Date("2026-08-20T21:00:00Z"),
        };
    });

    test("asks first rather than refusing", async () => {
        activeAssignments = [{ id: "a1" }, { id: "a2" }, { id: "a3" }];

        const result = await assignWorker({ workerIds: ["wkr_new"] }, "shf_1", ORG);

        expect(result.success).toBe(false);
        expect(result.warning).toBe(true);
        expect(result.capacityConflict).toEqual({
            capacityTotal: 3,
            filled: 3,
            adding: 1,
            overBy: 1,
        });
        expect(insertedAssignments).toHaveLength(0);
    });

    test("goes ahead when forced, and records that it did", async () => {
        activeAssignments = [{ id: "a1" }, { id: "a2" }, { id: "a3" }];

        const result = await assignWorker(
            { workerIds: ["wkr_new"] },
            "shf_1",
            ORG,
            undefined,
            true,
            "user_manager",
        );

        expect(result.success).toBe(true);
        expect(insertedAssignments).toHaveLength(1);
        expect(auditEntries).toHaveLength(1);
        expect(auditEntries[0]!.action).toBe("shift.capacity_override");
        expect(auditEntries[0]!.actorId).toBe("user_manager");
        expect(auditEntries[0]!.metadata).toMatchObject({ capacityTotal: 3, overBy: 1 });
    });

    test("stays quiet while there is still room", async () => {
        activeAssignments = [{ id: "a1" }];

        const result = await assignWorker({ workerIds: ["wkr_new"] }, "shf_1", ORG);

        expect(result.success).toBe(true);
        expect(insertedAssignments).toHaveLength(1);
        expect(auditEntries).toHaveLength(0);
    });

    test("filling the last slot exactly is not over capacity", async () => {
        activeAssignments = [{ id: "a1" }, { id: "a2" }];

        const result = await assignWorker({ workerIds: ["wkr_new"] }, "shf_1", ORG);

        expect(result.success).toBe(true);
        expect(auditEntries).toHaveLength(0);
    });

    test("counts the whole batch, not one at a time", async () => {
        activeAssignments = [{ id: "a1" }];
        ownedWorkerIds = ["wkr_a", "wkr_b", "wkr_c"];

        const result = await assignWorker(
            { workerIds: ["wkr_a", "wkr_b", "wkr_c"] },
            "shf_1",
            ORG,
        );

        expect(result.warning).toBe(true);
        expect(result.capacityConflict?.overBy).toBe(1); // 1 + 3 = 4 against 3
    });
});

describe("who can be assigned", () => {
    beforeEach(() => {
        insertedAssignments = [];
        activeAssignments = [];
        shiftRow = {
            id: "shf_1",
            status: "published",
            title: "Loader",
            price: 0,
            capacityTotal: 3,
            startTime: new Date("2026-08-20T13:00:00Z"),
            endTime: new Date("2026-08-20T21:00:00Z"),
        };
    });

    test("refuses a worker who is not on this business's list", async () => {
        ownedWorkerIds = [];

        await expect(assignWorker({ workerIds: ["wkr_other_business"] }, "shf_1", ORG)).rejects.toMatchObject({
            code: "NOT_FOUND",
            statusCode: 404,
        });
        expect(insertedAssignments).toHaveLength(0);
    });

    test("one worker id covers staff and agency temps alike", async () => {
        ownedWorkerIds = ["wkr_staff", "wkr_temp"];

        const result = await assignWorker({ workerIds: ["wkr_staff", "wkr_temp"] }, "shf_1", ORG);

        expect(result.success).toBe(true);
        expect(insertedAssignments).toHaveLength(2);
        expect(insertedAssignments.map((row) => (row as { workerId: string }).workerId)).toEqual(["wkr_staff", "wkr_temp"]);
    });
});
