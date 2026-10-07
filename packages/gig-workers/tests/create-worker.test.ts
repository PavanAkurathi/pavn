import { beforeEach, describe, expect, mock, test } from "bun:test";
import { MockAppError, drizzleStub, schemaStub } from "./_mocks";

type Row = Record<string, unknown>;

const mockFindFirst = mock((): Promise<Row | null> => Promise.resolve(null));
const mockReturning = mock((): Promise<Row[]> => Promise.resolve([{ id: "wkr_1" }]));
const inserted: Row[] = [];
const mockValues = mock((values: Row) => {
    inserted.push(values);
    return { returning: mockReturning };
});
const mockInsert = mock(() => ({ values: mockValues }));

mock.module("@repo/database", () => ({
    db: { query: { worker: { findFirst: mockFindFirst } }, insert: mockInsert },
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

describe("createWorker", () => {
    beforeEach(() => {
        mockFindFirst.mockClear();
        mockInsert.mockClear();
        mockValues.mockClear();
        inserted.length = 0;
        mockFindFirst.mockResolvedValue(null);
        mockReturning.mockResolvedValue([{ id: "wkr_1" }]);
    });

    test("puts the worker on the business's list as 'added', with a normalized phone", async () => {
        const { createWorker } = await import("../src/modules/workers/create-worker");

        await createWorker("org_1", {
            name: "  Casey Lee ",
            phoneNumber: "(312) 555-0100",
            roles: ["Server"],
            hourlyRate: 2200,
        });

        const values = inserted[0]!;
        expect(values).toMatchObject({
            organizationId: "org_1",
            name: "Casey Lee",
            phoneNumber: "+13125550100",
            roles: ["Server"],
            jobTitle: "Server",
            hourlyRate: 2200,
            employmentType: "staff",
            status: "added",
        });
        expect(String(values.id)).toStartWith("wkr_");
    });

    test("a worker with no phone yet is fine: they can be scheduled before they are invited", async () => {
        const { createWorker } = await import("../src/modules/workers/create-worker");

        await createWorker("org_1", { name: "Pat" });

        expect(inserted[0]!.phoneNumber).toBeNull();
    });

    test("rejects a phone number that isn't one", async () => {
        const { createWorker } = await import("../src/modules/workers/create-worker");

        await expect(createWorker("org_1", { name: "Pat", phoneNumber: "call me" })).rejects.toMatchObject({
            name: "AppError",
            code: "VALIDATION_ERROR",
            statusCode: 400,
        });
        expect(mockInsert).not.toHaveBeenCalled();
    });

    test("rejects a number already on the same business's list", async () => {
        mockFindFirst.mockResolvedValue({ id: "wkr_existing" });
        const { createWorker } = await import("../src/modules/workers/create-worker");

        await expect(createWorker("org_1", { name: "Pat", phoneNumber: "312 555 0100" })).rejects.toMatchObject({
            name: "AppError",
            code: "WORKER_ALREADY_EXISTS",
            statusCode: 409,
        });
        expect(mockInsert).not.toHaveBeenCalled();
    });
});
