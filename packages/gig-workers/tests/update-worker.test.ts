import { beforeEach, describe, expect, mock, test } from "bun:test";
import { MockAppError, drizzleStub, schemaStub } from "./_mocks";

type Row = Record<string, unknown>;

const mockFindFirst = mock((): Promise<Row | null> => Promise.resolve({ id: "wkr_1", roles: [], jobTitle: null }));
const mockReturning = mock(() => Promise.resolve([{ id: "wkr_1" }]));
const mockWhere = mock(() => ({ returning: mockReturning }));
const setCalls: Row[] = [];
const mockSet = mock((values: Row) => {
    setCalls.push(values);
    return { where: mockWhere };
});
const mockUpdate = mock(() => ({ set: mockSet }));

mock.module("@repo/database", () => ({
    db: { query: { worker: { findFirst: mockFindFirst } }, update: mockUpdate },
    resolveWorkerRoleSet: ({ roles, fallbackRole }: { roles?: string[]; fallbackRole?: string | null }) =>
        [...(roles ?? []), ...(fallbackRole ? [fallbackRole] : [])].filter((role, i, all) => all.indexOf(role) === i),
}));
mock.module("@repo/database/schema", () => schemaStub);
mock.module("drizzle-orm", () => drizzleStub);
mock.module("@repo/auth", () => ({
    isValidPhoneNumber: (value: string) => /^\+?\d{10,15}$/.test(value.replace(/[\s()-]/g, "")),
    normalizePhoneNumber: (value: string) => `+1${value.replace(/\D/g, "").slice(-10)}`,
}));
mock.module("@repo/observability", () => ({ AppError: MockAppError }));

describe("updateWorker", () => {
    beforeEach(() => {
        mockFindFirst.mockReset();
        mockUpdate.mockClear();
        mockSet.mockClear();
        setCalls.length = 0;
        mockFindFirst.mockResolvedValue({ id: "wkr_1", roles: [], jobTitle: null });
    });

    test("accepts only validated worker fields", async () => {
        const { updateWorker } = await import("../src/modules/workers/update-worker");

        await updateWorker({ name: "Casey L.", jobTitle: "Server", hourlyRate: 2200 }, "wkr_1", "org_1");

        const payload = setCalls[0]!;
        expect(payload).toMatchObject({ name: "Casey L.", jobTitle: "Server", roles: ["Server"], hourlyRate: 2200 });
        expect(payload.updatedAt).toBeInstanceOf(Date);
    });

    test("rejects unknown worker fields, such as moving a worker to another business", async () => {
        const { updateWorker } = await import("../src/modules/workers/update-worker");

        await expect(
            updateWorker({ organizationId: "other-org", name: "Casey" }, "wkr_1", "org_1"),
        ).rejects.toMatchObject({ name: "AppError", code: "VALIDATION_ERROR", statusCode: 400 });
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    test("only touches workers of the caller's own business", async () => {
        mockFindFirst.mockResolvedValue(null);
        const { updateWorker } = await import("../src/modules/workers/update-worker");

        await expect(updateWorker({ name: "Casey" }, "wkr_1", "org_1")).rejects.toMatchObject({
            code: "NOT_FOUND",
            statusCode: 404,
        });
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    test("won't give one worker another's phone number", async () => {
        mockFindFirst
            .mockResolvedValueOnce({ id: "wkr_1", roles: [], jobTitle: null }) // the worker
            .mockResolvedValueOnce({ id: "wkr_2" }); // someone else already has the number
        const { updateWorker } = await import("../src/modules/workers/update-worker");

        await expect(updateWorker({ phoneNumber: "312 555 0100" }, "wkr_1", "org_1")).rejects.toMatchObject({
            code: "WORKER_ALREADY_EXISTS",
            statusCode: 409,
        });
        expect(mockUpdate).not.toHaveBeenCalled();
    });
});
