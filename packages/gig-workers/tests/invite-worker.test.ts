import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockUserFindFirst = mock(() => Promise.resolve(null));
const mockMemberFindFirst = mock(() => Promise.resolve(null));
const mockInvitationFindFirst = mock(() => Promise.resolve(null));

mock.module("@repo/database", () => ({
    db: {
        query: {
            user: { findFirst: mockUserFindFirst },
            member: { findFirst: mockMemberFindFirst },
            invitation: { findFirst: mockInvitationFindFirst },
        },
    },
    resolveWorkerRoleSet: () => [],
}));

mock.module("@repo/database/schema", () => ({
    invitation: {
        email: "email",
        organizationId: "organizationId",
        status: "status",
    },
    user: { email: "email" },
    member: {
        userId: "userId",
        organizationId: "organizationId",
    },
    rosterEntry: {
        email: "email",
        organizationId: "organizationId",
    },
    auditLog: { actorId: "actorId" },
}));

mock.module("drizzle-orm", () => ({
    eq: (...args: unknown[]) => ({ op: "eq", args }),
    and: (...args: unknown[]) => ({ op: "and", args }),
}));

mock.module("@repo/auth", () => ({
    normalizePhoneNumber: (value: string) => value,
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

describe("inviteWorker", () => {
    beforeEach(() => {
        mockUserFindFirst.mockClear();
        mockMemberFindFirst.mockClear();
        mockInvitationFindFirst.mockClear();
        mockUserFindFirst.mockResolvedValue(null);
        mockMemberFindFirst.mockResolvedValue(null);
        mockInvitationFindFirst.mockResolvedValue(null);
    });

    test("rejects missing inviter ids with AppError", async () => {
        const { inviteWorker } = await import("../src/modules/roster/invite-worker");

        await expect(
            inviteWorker({ email: "worker@example.com" }, "org_1"),
        ).rejects.toMatchObject({
            name: "AppError",
            code: "VALIDATION_ERROR",
            statusCode: 400,
        });
    });

    test("rejects duplicate members with AppError", async () => {
        mockUserFindFirst.mockResolvedValue({ id: "user_1" });
        mockMemberFindFirst.mockResolvedValue({ id: "member_1" });
        const { inviteWorker } = await import("../src/modules/roster/invite-worker");

        await expect(
            inviteWorker({ email: "worker@example.com" }, "org_1", "inviter_1"),
        ).rejects.toMatchObject({
            name: "AppError",
            code: "MEMBER_ALREADY_EXISTS",
            statusCode: 409,
        });
    });
});
