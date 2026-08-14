import { describe, test, expect, mock, beforeEach } from "bun:test";

let draftRows: unknown[] = [];
const updates: { id: string; status: string }[] = [];
const insertedNotifications: unknown[] = [];

const mockDb = {
    query: {
        shift: {
            findMany: mock(() => Promise.resolve(draftRows)),
        },
        workerNotificationPreferences: {
            findMany: mock(() => Promise.resolve([])),
        },
    },
    transaction: mock(async (fn: (tx: unknown) => Promise<void>) => {
        let pendingStatus = "";
        const tx = {
            update: () => ({
                set: (values: { status: string }) => {
                    pendingStatus = values.status;
                    return {
                        // The id lives inside a drizzle condition we do not want to
                        // parse, so the module records it for us via call order.
                        where: () => {
                            updates.push({ id: updateTargets.shift(), status: pendingStatus });
                            return Promise.resolve();
                        },
                    };
                },
            }),
            insert: () => ({
                values: (rows: unknown[]) => {
                    insertedNotifications.push(...rows);
                    return Promise.resolve();
                },
            }),
        };
        await fn(tx);
    }),
};

// Statuses are asserted in the order the module iterates its drafts.
let updateCursor = 0;
const updateTargets = {
    shift: () => (draftRows[updateCursor++] as { id: string }).id,
};

mock.module("@repo/database", () => ({ db: mockDb }));
mock.module("@repo/notifications", () => ({
    buildNotificationSchedule: mock(async (workerId: string, shiftId: string) => [
        { id: `notif_${workerId}_${shiftId}`, workerId, shiftId },
    ]),
}));
mock.module("../src/modules/time-tracking/cross-org-conflict-notifications", () => ({
    notifyWorkersOfCrossOrgConflicts: mock(() => Promise.resolve()),
}));

const { publishDrafts } = await import("../src/modules/shifts/publish-drafts");

const ORG = "org_1";
const FUTURE_START = new Date(Date.now() + 86_400_000);
const FUTURE_END = new Date(Date.now() + 86_400_000 + 8 * 3_600_000);

const draft = (over: Record<string, unknown> = {}) => ({
    id: "shf_1",
    title: "Loader",
    startTime: FUTURE_START,
    endTime: FUTURE_END,
    capacityTotal: 2,
    location: { name: "Boston Warehouse" },
    assignments: [],
    ...over,
});

describe("publishDrafts", () => {
    beforeEach(() => {
        draftRows = [];
        updates.length = 0;
        insertedNotifications.length = 0;
        updateCursor = 0;
    });

    test("a fully staffed draft becomes assigned, a half-empty one stays published", async () => {
        draftRows = [
            draft({
                id: "shf_full",
                capacityTotal: 2,
                assignments: [
                    { workerId: "user_1", status: "active" },
                    { workerId: "user_2", status: "active" },
                ],
            }),
            draft({
                id: "shf_open",
                capacityTotal: 3,
                assignments: [{ workerId: "user_3", status: "active" }],
            }),
        ];

        const result = await publishDrafts({ shiftIds: ["shf_full", "shf_open"] }, ORG);

        expect(result.published).toBe(2);
        expect(updates).toEqual([
            { id: "shf_full", status: "assigned" },
            { id: "shf_open", status: "published" },
        ]);
    });

    test("notifies assigned app users and nobody else", async () => {
        draftRows = [
            draft({
                assignments: [
                    { workerId: "user_1", status: "active" },
                    // invited and agency workers have no device to reach
                    { workerId: null, rosterEntryId: "roster_1", status: "active" },
                    { workerId: null, tempWorkerId: "temp_1", status: "active" },
                    { workerId: "user_2", status: "removed" },
                ],
            }),
        ];

        const result = await publishDrafts({ shiftIds: ["shf_1"] }, ORG);

        expect(result.notified).toBe(1);
        expect(insertedNotifications).toHaveLength(1);
        expect((insertedNotifications[0] as { workerId: string }).workerId).toBe("user_1");
    });

    test("refuses to announce work that has already happened", async () => {
        draftRows = [
            draft({
                startTime: new Date(Date.now() - 2 * 86_400_000),
                endTime: new Date(Date.now() - 86_400_000),
            }),
        ];

        await expect(publishDrafts({ shiftIds: ["shf_1"] }, ORG)).rejects.toThrow(/already ended/);
        expect(updates).toHaveLength(0);
    });

    test("publishes the live drafts and reports the expired ones", async () => {
        draftRows = [
            draft({ id: "shf_live" }),
            draft({
                id: "shf_stale",
                startTime: new Date(Date.now() - 2 * 86_400_000),
                endTime: new Date(Date.now() - 86_400_000),
            }),
        ];

        const result = await publishDrafts({ shiftIds: ["shf_live", "shf_stale"] }, ORG);

        expect(result.published).toBe(1);
        expect(result.expired).toBe(1);
        expect(updates).toEqual([{ id: "shf_live", status: "published" }]);
    });

    test("404s when the ids match nothing in this org", async () => {
        await expect(publishDrafts({ shiftIds: ["shf_other_org"] }, ORG)).rejects.toThrow(
            /No draft shifts found/,
        );
    });

    test("rejects an empty selection", async () => {
        await expect(publishDrafts({ shiftIds: [] }, ORG)).rejects.toThrow(/Validation failed/);
    });
});
