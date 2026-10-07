// Shared stand-ins for the modules the worker code imports. Each test file runs
// in its own process (scripts/run-package-tests.mjs), so registering these per
// file never leaks.
export class MockAppError extends Error {
    constructor(
        public message: string,
        public code: string,
        public statusCode: number,
        public details?: unknown,
    ) {
        super(message);
        this.name = "AppError";
    }
}

export const schemaStub = {
    worker: {
        id: "worker.id",
        organizationId: "worker.organizationId",
        userId: "worker.userId",
        name: "worker.name",
        phoneNumber: "worker.phoneNumber",
        email: "worker.email",
        status: "worker.status",
        inviteCode: "worker.inviteCode",
    },
    organization: { id: "organization.id", name: "organization.name" },
    member: { organizationId: "member.organizationId", userId: "member.userId" },
    shiftAssignment: { id: "shiftAssignment.id", workerId: "shiftAssignment.workerId" },
};

export const drizzleStub = {
    eq: (...args: unknown[]) => ({ op: "eq", args }),
    and: (...args: unknown[]) => ({ op: "and", args }),
    ne: (...args: unknown[]) => ({ op: "ne", args }),
    asc: (...args: unknown[]) => ({ op: "asc", args }),
    ilike: (...args: unknown[]) => ({ op: "ilike", args }),
    inArray: (...args: unknown[]) => ({ op: "inArray", args }),
};
