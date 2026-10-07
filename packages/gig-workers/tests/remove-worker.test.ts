import { beforeEach, describe, expect, mock, test } from "bun:test";
import { MockAppError, drizzleStub, schemaStub } from "./_mocks";

type Row = Record<string, unknown>;

const mockFindFirst = mock((): Promise<Row | null> => Promise.resolve(null));
let history: Row[] = [];

type Chain = { from: () => Chain; where: () => Chain; limit: () => Promise<Row[]> };
const mockSelect = mock((): Chain => {
    const chain: Chain = { from: () => chain, where: () => chain, limit: () => Promise.resolve(history) };
    return chain;
});

const updates: { table: unknown; values: Row }[] = [];
type Updated = PromiseLike<undefined> & { returning: () => Promise<Row[]> };
const mockUpdate = mock((table: unknown) => ({
    set: (values: Row) => {
        updates.push({ table, values });
        const done: Updated = {
            returning: () => Promise.resolve([{ id: "wkr_1", ...values }]),
            then: (onfulfilled, onrejected) => Promise.resolve(undefined).then(onfulfilled, onrejected),
        };
        return { where: () => done };
    },
}));
const mockDeleteWhere = mock(() => Promise.resolve());
const mockDelete = mock(() => ({ where: mockDeleteWhere }));

mock.module("@repo/database", () => ({
    db: { query: { worker: { findFirst: mockFindFirst } }, select: mockSelect, update: mockUpdate, delete: mockDelete },
}));
mock.module("@repo/database/schema", () => schemaStub);
mock.module("drizzle-orm", () => drizzleStub);
mock.module("@repo/observability", () => ({ AppError: MockAppError }));

const memberUpdates = () => updates.filter((u) => u.table === schemaStub.member).map((u) => u.values.status);

describe("removing and reactivating workers", () => {
    beforeEach(() => {
        history = [];
        updates.length = 0;
        mockFindFirst.mockReset();
        mockDelete.mockClear();
        mockDeleteWhere.mockClear();
        mockFindFirst.mockResolvedValue({ id: "wkr_1", userId: "user_1", invitedAt: null });
    });

    test("someone who never worked a shift is deleted outright", async () => {
        const { removeWorker } = await import("../src/modules/workers/remove-worker");

        const result = await removeWorker("wkr_1", "org_1");

        expect(result).toMatchObject({ removed: true, status: "removed" });
        expect(mockDelete).toHaveBeenCalledTimes(1);
    });

    test("someone with shift history is kept as inactive so their hours stay on record", async () => {
        history = [{ id: "asg_1" }];
        const { removeWorker } = await import("../src/modules/workers/remove-worker");

        const result = await removeWorker("wkr_1", "org_1");

        expect(result).toMatchObject({ removed: false, status: "inactive" });
        expect(mockDelete).not.toHaveBeenCalled();
        expect(updates.some((u) => u.table === schemaStub.worker && u.values.status === "inactive")).toBe(true);
    });

    test("a signed-in worker loses access to the business straight away, either way", async () => {
        const { removeWorker } = await import("../src/modules/workers/remove-worker");

        await removeWorker("wkr_1", "org_1");

        expect(memberUpdates()).toEqual(["inactive"]);
    });

    test("only touches workers of the caller's own business", async () => {
        mockFindFirst.mockResolvedValue(null);
        const { removeWorker } = await import("../src/modules/workers/remove-worker");

        await expect(removeWorker("wkr_1", "org_1")).rejects.toMatchObject({ code: "NOT_FOUND", statusCode: 404 });
        expect(mockDelete).not.toHaveBeenCalled();
    });

    test("reactivating puts them back where they were", async () => {
        const { reactivateWorker } = await import("../src/modules/workers/remove-worker");

        mockFindFirst.mockResolvedValue({ id: "wkr_1", userId: "user_1", invitedAt: null });
        await reactivateWorker("wkr_1", "org_1");
        expect(updates.filter((u) => u.table === schemaStub.worker).at(-1)?.values.status).toBe("active");
        expect(memberUpdates()).toEqual(["active"]);

        updates.length = 0;
        mockFindFirst.mockResolvedValue({ id: "wkr_1", userId: null, invitedAt: new Date() });
        await reactivateWorker("wkr_1", "org_1");
        expect(updates.filter((u) => u.table === schemaStub.worker).at(-1)?.values.status).toBe("invited");

        updates.length = 0;
        mockFindFirst.mockResolvedValue({ id: "wkr_1", userId: null, invitedAt: null });
        await reactivateWorker("wkr_1", "org_1");
        expect(updates.filter((u) => u.table === schemaStub.worker).at(-1)?.values.status).toBe("added");
    });
});
