import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockFindFirst = mock(() => Promise.resolve({ id: "member_1" }));
const mockReturning = mock(() => Promise.resolve([{ id: "member_1" }]));
const mockWhere = mock(() => ({ returning: mockReturning }));
const mockSet = mock(() => ({ where: mockWhere }));
const mockUpdate = mock(() => ({ set: mockSet }));

mock.module("@repo/database", () => ({
    db: {
        query: {
            member: { findFirst: mockFindFirst },
        },
        update: mockUpdate,
    },
}));

mock.module("@repo/database/schema", () => ({
    member: { id: "id", organizationId: "organizationId" },
    organization: { id: "id" },
}));

mock.module("drizzle-orm", () => ({
    eq: (...args: unknown[]) => ({ op: "eq", args }),
    and: (...args: unknown[]) => ({ op: "and", args }),
}));

mock.module("@repo/observability", () => ({
    AppError: class extends Error {
        constructor(
            public message: string,
            public code: string,
            public statusCode: number,
            public details?: unknown
        ) {
            super(message);
            this.name = "AppError";
        }
    },
}));

describe("updateWorker", () => {
    beforeEach(() => {
        mockFindFirst.mockClear();
        mockUpdate.mockClear();
        mockSet.mockClear();
        mockWhere.mockClear();
        mockReturning.mockClear();
        mockFindFirst.mockResolvedValue({ id: "member_1" });
    });

    test("accepts only validated worker fields", async () => {
        const { updateWorker } = await import("../src/modules/workers/update-worker");

        await updateWorker(
            {
                role: "member",
                jobTitle: "Server",
                hourlyRate: 2200,
            },
            "member_1",
            "org_1"
        );

        const payload = (mockSet.mock.calls[0] as [Record<string, unknown>] | undefined)?.[0];
        if (!payload) {
            throw new Error("Expected update payload");
        }
        expect(payload.role).toBe("member");
        expect(payload.jobTitle).toBe("Server");
        expect(payload.hourlyRate).toBe(2200);
        expect(payload.updatedAt).toBeInstanceOf(Date);
    });

    test("rejects unknown worker fields", async () => {
        const { updateWorker } = await import("../src/modules/workers/update-worker");

        await expect(updateWorker(
            {
                organizationId: "other-org",
                role: "member",
            },
            "member_1",
            "org_1"
        )).rejects.toMatchObject({
            name: "AppError",
            code: "VALIDATION_ERROR",
            statusCode: 400,
        });

        expect(mockUpdate).not.toHaveBeenCalled();
    });
});
