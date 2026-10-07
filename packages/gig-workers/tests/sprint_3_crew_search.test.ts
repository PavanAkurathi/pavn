import { describe, expect, test, mock, beforeEach } from "bun:test";
import { drizzleStub, schemaStub } from "./_mocks";

const asked: { limit?: number; offset?: number } = {};
const mockOffset = mock((n: number): Promise<unknown[]> => {
    asked.offset = n;
    return Promise.resolve([]);
});
const mockLimit = mock((n: number) => {
    asked.limit = n;
    return { offset: mockOffset };
});
const mockOrderBy = mock(() => ({ limit: mockLimit }));
const mockWhere = mock(() => ({ orderBy: mockOrderBy }));
const mockFrom = mock(() => ({ where: mockWhere }));
const mockSelect = mock(() => ({ from: mockFrom }));

mock.module("@repo/database", () => ({ db: { select: mockSelect } }));
mock.module("@repo/database/schema", () => schemaStub);
mock.module("drizzle-orm", () => drizzleStub);

import { getCrew } from "../src/modules/workers/list-workers";

const workerRow = (overrides: Record<string, unknown> = {}) => ({
    id: "wkr_1",
    organizationId: "org_1",
    userId: null,
    name: "John Doe",
    phoneNumber: "+13125550100",
    email: null,
    employmentType: "staff",
    agency: null,
    jobTitle: "shift_lead",
    roles: ["barista", "dishwasher"],
    hourlyRate: null,
    notes: null,
    inviteCode: null,
    status: "added",
    invitedAt: null,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    ...overrides,
});

describe("WH-116: Crew Search", () => {
    beforeEach(() => {
        mockSelect.mockClear();
        mockWhere.mockClear();
        mockLimit.mockClear();
        mockOffset.mockClear();
        asked.limit = undefined;
        asked.offset = undefined;
    });

    test("passes search term to DB query", async () => {
        await getCrew("org_1", { search: "John", limit: 10, offset: 0 });
        expect(mockSelect).toHaveBeenCalled();
        expect(asked.limit).toBe(10);
    });

    test("passes pagination params", async () => {
        await getCrew("org_1", { limit: 5, offset: 10 });
        expect(asked).toEqual({ limit: 5, offset: 10 });
    });

    test("returns normalized roles with the job title as a fallback", async () => {
        mockOffset.mockImplementationOnce(() => Promise.resolve([workerRow()]));

        const result = await getCrew("org_1");

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            id: "wkr_1",
            name: "John Doe",
            role: "Barista",
            roles: ["Barista", "Dishwasher", "Shift Lead"],
            initials: "JD",
            status: "added",
            hasAccount: false,
            invitePending: false,
        });
    });

    test("says who has been invited but hasn't signed in, and who has", async () => {
        mockOffset.mockImplementationOnce(() => Promise.resolve([
            workerRow({ id: "wkr_a", status: "invited" }),
            workerRow({ id: "wkr_b", status: "active", userId: "user_1" }),
        ]));

        const result = await getCrew("org_1");

        expect(result.map((w) => [w.id, w.hasAccount, w.invitePending])).toEqual([
            ["wkr_a", false, true],
            ["wkr_b", true, false],
        ]);
    });
});
