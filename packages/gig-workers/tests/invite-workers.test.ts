import { beforeEach, describe, expect, mock, test } from "bun:test";
import { MockAppError, drizzleStub, schemaStub } from "./_mocks";

type Row = Record<string, unknown>;

// db.select() is called twice per invite run: the business, then the workers.
let selectResults: Row[][] = [];
const setCalls: Row[] = [];
const mockUpdateSet = mock((values: Row) => {
    setCalls.push(values);
    return { where: () => ({ returning: () => Promise.resolve([{ inviteCode: "ABCD2345" }]) }) };
});
const mockUpdate = mock(() => ({ set: mockUpdateSet }));

type Chain = PromiseLike<Row[]> & { from: () => Chain; where: () => Chain; limit: () => Promise<Row[]> };
const mockSelect = mock((): Chain => {
    const result = selectResults.shift() ?? [];
    const chain: Chain = {
        from: () => chain,
        where: () => chain,
        limit: () => Promise.resolve(result),
        then: (onfulfilled, onrejected) => Promise.resolve(result).then(onfulfilled, onrejected),
    };
    return chain;
});
const sent: { to: string; body: string }[] = [];
const mockSendSMS = mock(async (to: string, body: string) => {
    sent.push({ to, body });
});

mock.module("@repo/database", () => ({ db: { select: mockSelect, update: mockUpdate } }));
mock.module("@repo/database/schema", () => schemaStub);
mock.module("drizzle-orm", () => drizzleStub);
mock.module("@repo/auth", () => ({ sendSMS: mockSendSMS }));
mock.module("@repo/dub", () => ({ dub: { links: { create: () => Promise.reject(new Error("no dub in tests")) } } }));
mock.module("@repo/observability", () => ({ AppError: MockAppError }));

const worker = (overrides: Row = {}): Row => ({
    id: "wkr_1",
    name: "Casey",
    phoneNumber: "+13125550100",
    employmentType: "staff",
    status: "added",
    inviteCode: null,
    ...overrides,
});

describe("inviteWorkers", () => {
    beforeEach(() => {
        selectResults = [];
        mockSelect.mockClear();
        mockUpdate.mockClear();
        mockUpdateSet.mockClear();
        setCalls.length = 0;
        mockSendSMS.mockClear();
        sent.length = 0;
        process.env.DUB_API_KEY = "";
    });

    test("texts the business's link and code, and marks the worker invited", async () => {
        selectResults = [[{ name: "Cafe Nord" }], [worker({ inviteCode: "ABCD2345" })]];
        const { inviteWorkers } = await import("../src/modules/workers/invite-workers");

        const result = await inviteWorkers("org_1", ["wkr_1"]);

        expect(result.invited).toBe(1);
        expect(result.skipped).toEqual([]);
        expect(result.links.wkr_1).toBe("https://links.workershive.com/invite/ABCD2345");
        expect(sent).toHaveLength(1);
        expect(sent[0]!.to).toBe("+13125550100");
        expect(sent[0]!.body).toContain("Cafe Nord");
        expect(sent[0]!.body).toContain("https://links.workershive.com/invite/ABCD2345");
        expect(sent[0]!.body).toContain("ABCD2345");
        const marked = setCalls.at(-1)!;
        expect(marked.status).toBe("invited");
        expect(marked.invitedAt).toBeInstanceOf(Date);
    });

    test("gives a worker without a code one before texting", async () => {
        selectResults = [[{ name: "Cafe Nord" }], [worker({ inviteCode: null })]];
        const { inviteWorkers } = await import("../src/modules/workers/invite-workers");

        const result = await inviteWorkers("org_1", ["wkr_1"]);

        expect(result.invited).toBe(1);
        expect(result.links.wkr_1).toContain("/invite/ABCD2345");
    });

    test("skips, with a reason, anyone who can't be invited", async () => {
        selectResults = [[{ name: "Cafe Nord" }], [
            worker({ id: "wkr_a", name: "No Phone", phoneNumber: null }),
            worker({ id: "wkr_b", name: "A Temp", employmentType: "agency" }),
            worker({ id: "wkr_c", name: "Already In", status: "active" }),
            worker({ id: "wkr_d", name: "Paused", status: "inactive" }),
        ]];
        const { inviteWorkers } = await import("../src/modules/workers/invite-workers");

        const result = await inviteWorkers("org_1", ["wkr_a", "wkr_b", "wkr_c", "wkr_d"]);

        expect(result.invited).toBe(0);
        expect(result.skipped.map((s) => [s.id, s.reason])).toEqual([
            ["wkr_a", "Add a mobile number first."],
            ["wkr_b", "Agency temps don't use the app."],
            ["wkr_c", "Already on the app."],
            ["wkr_d", "Reactivate them first."],
        ]);
        expect(mockSendSMS).not.toHaveBeenCalled();
    });

    test("does nothing for an empty list", async () => {
        const { inviteWorkers } = await import("../src/modules/workers/invite-workers");

        expect(await inviteWorkers("org_1", [])).toEqual({ invited: 0, skipped: [], links: {} });
        expect(mockSelect).not.toHaveBeenCalled();
    });
});
