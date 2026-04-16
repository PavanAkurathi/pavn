import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockReturning = mock(() => Promise.resolve([{ id: "user_1", name: "Ada" }]));
const mockWhere = mock(() => ({ returning: mockReturning }));
const mockSet = mock(() => ({ where: mockWhere }));
const mockUpdate = mock(() => ({ set: mockSet }));

mock.module("@repo/database", () => ({
    db: {
        update: mockUpdate,
    },
}));

mock.module("@repo/database/schema", () => ({
    user: { id: "id" },
    auditLog: { actorId: "actorId" },
}));

mock.module("drizzle-orm", () => ({
    eq: (...args: unknown[]) => ({ op: "eq", args }),
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

describe("updateWorkerProfile", () => {
    beforeEach(() => {
        mockUpdate.mockClear();
        mockSet.mockClear();
        mockWhere.mockClear();
        mockReturning.mockClear();
        mockReturning.mockResolvedValue([{ id: "user_1", name: "Ada" }]);
    });

    test("rejects invalid payloads with AppError", async () => {
        const { updateWorkerProfile } = await import("../src/modules/profile/update-worker-profile");

        await expect(updateWorkerProfile("user_1", { name: 123 })).rejects.toMatchObject({
            name: "AppError",
            code: "VALIDATION_ERROR",
            statusCode: 400,
        });
    });

    test("rejects empty updates with AppError", async () => {
        const { updateWorkerProfile } = await import("../src/modules/profile/update-worker-profile");

        await expect(updateWorkerProfile("user_1", {})).rejects.toMatchObject({
            name: "AppError",
            code: "VALIDATION_ERROR",
            statusCode: 400,
        });
    });

    test("rejects missing users with AppError", async () => {
        mockReturning.mockResolvedValue([]);
        const { updateWorkerProfile } = await import("../src/modules/profile/update-worker-profile");

        await expect(updateWorkerProfile("user_404", { name: "Ada" })).rejects.toMatchObject({
            name: "AppError",
            code: "NOT_FOUND",
            statusCode: 404,
        });
    });
});
