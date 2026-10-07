import { beforeEach, describe, expect, mock, test } from "bun:test";
import { MockAppError, drizzleStub, schemaStub } from "./_mocks";

type Row = Record<string, unknown>;

const created: Row[] = [];
const invited: string[][] = [];
let existingByPhone: Row | null = null;
let inviteResult: { invited: number; skipped: { id: string; name: string; reason: string }[]; links: Record<string, string> } = {
    invited: 1,
    skipped: [],
    links: { wkr_new: "https://links.workershive.com/invite/ABCD2345" },
};

const select = mock(() => ({
    from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: "wkr_new", name: "Jamie", status: "invited" }]) }) }),
}));

mock.module("@repo/database", () => ({ db: { select } }));
mock.module("@repo/database/schema", () => schemaStub);
mock.module("drizzle-orm", () => drizzleStub);
mock.module("@repo/observability", () => ({ AppError: MockAppError }));
mock.module("../src/modules/workers/create-worker", () => ({
    parseWorkerPhone: (raw: string | null | undefined) => (raw ? `+1${raw.replace(/\D/g, "").slice(-10)}` : null),
    findWorkerByPhone: mock(async () => existingByPhone),
    createWorker: mock(async (_orgId: string, fields: Row) => {
        created.push(fields);
        return { id: "wkr_new", name: fields.name };
    }),
}));
mock.module("../src/modules/workers/invite-workers", () => ({
    inviteWorkers: mock(async (_orgId: string, ids: string[]) => {
        invited.push(ids);
        return inviteResult;
    }),
}));

const { addWorker } = await import("../src/modules/workers/add-worker");

describe("addWorker", () => {
    beforeEach(() => {
        created.length = 0;
        invited.length = 0;
        existingByPhone = null;
        inviteResult = { invited: 1, skipped: [], links: { wkr_new: "https://links.workershive.com/invite/ABCD2345" } };
    });

    test("puts the worker on the list and texts the invite when asked", async () => {
        const result = await addWorker("org_1", { name: "Jamie", phoneNumber: "312-555-0111", invites: { sms: true } });

        expect(created).toHaveLength(1);
        expect(invited).toEqual([["wkr_new"]]);
        expect(result.link).toBe("https://links.workershive.com/invite/ABCD2345");
    });

    test("just adds them when no invite is wanted", async () => {
        const result = await addWorker("org_1", { name: "Jamie", invites: { sms: false } });

        expect(created).toHaveLength(1);
        expect(invited).toHaveLength(0);
        expect(result.link).toBeUndefined();
    });

    test("can't text an invite without a phone number", async () => {
        await expect(addWorker("org_1", { name: "Jamie", invites: { sms: true } })).rejects.toMatchObject({
            code: "VALIDATION_ERROR",
            statusCode: 400,
        });
        expect(created).toHaveLength(0);
    });

    test("refuses a number already on the list instead of renaming the person who has it", async () => {
        existingByPhone = { id: "wkr_existing", name: "Jamie Rivera" };

        await expect(
            addWorker("org_1", { name: "Jamie Again", phoneNumber: "312-555-0111", invites: { sms: true } }),
        ).rejects.toMatchObject({
            code: "WORKER_ALREADY_EXISTS",
            statusCode: 409,
            message: expect.stringContaining("Jamie Rivera"),
        });
        expect(created).toHaveLength(0);
        expect(invited).toHaveLength(0);
    });

    test("tells the manager when the invite could not go out", async () => {
        inviteResult = { invited: 0, skipped: [{ id: "wkr_new", name: "Jamie", reason: "The text could not be sent." }], links: {} };

        await expect(
            addWorker("org_1", { name: "Jamie", phoneNumber: "312-555-0111", invites: { sms: true } }),
        ).rejects.toMatchObject({ code: "INVITE_SKIPPED", message: "The text could not be sent." });
    });
});
