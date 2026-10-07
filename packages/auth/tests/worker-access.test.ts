import { beforeEach, describe, expect, mock, test } from "bun:test";

type Row = Record<string, unknown>;

// What the database hands back, set per test.
let invitedWorkers: Row[] = [];
let inviteLookup: Row[] = [];
let existingUser: Row | null = null;
let stillLinked: Row | null = null;
let membership: Row | null = null;

const workerUpdates: Row[] = [];
const userUpdates: Row[] = [];
const memberInserts: Row[] = [];
const memberUpdates: Row[] = [];
const statuses: unknown[][] = [];

type Pending = Promise<Row[]> & { limit: (n: number) => Promise<Row[]> };
type Chain = {
    from: () => Chain;
    innerJoin: () => Chain;
    where: (condition: unknown) => Pending;
};

const select = mock((): Chain => {
    // Two shapes: the eligibility query ends at .where(); the invite lookup adds .limit(1).
    const chain: Chain = {
        from: () => chain,
        innerJoin: () => chain,
        where: (condition: unknown) => {
            statuses.push([condition]);
            return Object.assign(Promise.resolve(invitedWorkers), { limit: () => Promise.resolve(inviteLookup) });
        },
    };
    return chain;
});

const workerFindFirst = mock((): Promise<Row | null> => Promise.resolve(stillLinked));
const memberFindFirst = mock((): Promise<Row | null> => Promise.resolve(membership));
const userFindFirst = mock((): Promise<Row | null> => Promise.resolve(existingUser));

const update = mock((table: unknown) => ({
    set: (values: Row) => {
        if (table === schema.worker) workerUpdates.push(values);
        else if (table === schema.user) userUpdates.push(values);
        else memberUpdates.push(values);
        return { where: () => Promise.resolve() };
    },
}));
const insert = mock(() => ({
    values: (values: Row) => {
        memberInserts.push(values);
        return Promise.resolve();
    },
}));

const schema = {
    worker: { id: "worker.id", userId: "worker.userId", phoneNumber: "worker.phoneNumber", status: "worker.status", organizationId: "worker.organizationId", inviteCode: "worker.inviteCode", name: "worker.name" },
    organization: { id: "organization.id", name: "organization.name" },
    member: { id: "member.id", userId: "member.userId", organizationId: "member.organizationId" },
    user: { id: "user.id", phoneNumber: "user.phoneNumber" },
};

mock.module("@repo/database", () => ({
    db: {
        select,
        update,
        insert,
        query: {
            worker: { findFirst: workerFindFirst },
            member: { findFirst: memberFindFirst },
            user: { findFirst: userFindFirst },
        },
    },
}));
mock.module("@repo/database/schema", () => schema);
mock.module("drizzle-orm", () => ({
    and: (...args: unknown[]) => ({ op: "and", args }),
    eq: (...args: unknown[]) => ({ op: "eq", args }),
    inArray: (column: unknown, values: unknown[]) => ({ op: "inArray", column, values }),
}));
mock.module("../src/providers/sms", () => ({
    isValidPhoneNumber: (value: string) => /^\+\d{11}$/.test(value),
    normalizePhoneNumber: (value: string) => value,
}));

const { getWorkerPhoneAccess, getWorkerInviteByCode, syncWorkerMembershipsForPhone } = await import("../src/worker-access");

const invited = (over: Row = {}): Row => ({
    workerId: "wkr_1",
    organizationId: "org_1",
    organizationName: "Cafe Nord",
    userId: null,
    name: "Casey Lee",
    status: "invited",
    ...over,
});

beforeEach(() => {
    invitedWorkers = [];
    inviteLookup = [];
    existingUser = null;
    stillLinked = null;
    membership = null;
    workerUpdates.length = 0;
    userUpdates.length = 0;
    memberInserts.length = 0;
    memberUpdates.length = 0;
    statuses.length = 0;
});

describe("who can sign in to the worker app", () => {
    test("a number a business has invited can", async () => {
        invitedWorkers = [invited(), invited({ workerId: "wkr_2", organizationId: "org_2", organizationName: "Harbor" })];

        const access = await getWorkerPhoneAccess("+13125550100");

        expect(access).toMatchObject({ eligible: true, organizationCount: 2, existingAccount: false, displayName: "Casey Lee" });
        expect(access.organizationIds).toEqual(["org_1", "org_2"]);
    });

    test("a number nobody has invited cannot", async () => {
        const access = await getWorkerPhoneAccess("+13125550100");

        expect(access).toMatchObject({ eligible: false, organizationCount: 0, organizationIds: [], workerAccess: [] });
    });

    test("only invited and active workers count; someone merely added to a list does not", async () => {
        await getWorkerPhoneAccess("+13125550100");

        // The eligibility query filters on status.
        const where = statuses[0]![0] as { args: { op?: string; values?: string[] }[] };
        const statusFilter = where.args.find((arg) => arg.op === "inArray");
        expect(statusFilter?.values).toEqual(["invited", "active"]);
    });

    test("says whether the number already has an account", async () => {
        existingUser = { id: "user_1", name: "Casey" };
        invitedWorkers = [invited({ status: "active", userId: "user_1" })];

        const access = await getWorkerPhoneAccess("+13125550100");

        expect(access).toMatchObject({ existingAccount: true, existingUserId: "user_1", displayName: "Casey" });
    });

    test("a malformed number is an error, not a quiet 'no'", async () => {
        await expect(getWorkerPhoneAccess("12345")).rejects.toThrow("Invalid phone number");
    });
});

describe("an invite code", () => {
    test("says which business and which person, and only a hint of the number", async () => {
        inviteLookup = [{ workerId: "wkr_1", name: "Casey Lee", phoneNumber: "+13125550142", status: "invited", organizationName: "Cafe Nord" }];

        const invite = await getWorkerInviteByCode(" abcd2345 ");

        expect(invite).toEqual({ workerId: "wkr_1", workerName: "Casey Lee", organizationName: "Cafe Nord", phoneHint: "42" });
    });

    test("is no good for a worker who was only added, or has been made inactive", async () => {
        inviteLookup = [{ workerId: "wkr_1", name: "Casey", phoneNumber: "+13125550142", status: "added", organizationName: "Cafe Nord" }];
        expect(await getWorkerInviteByCode("ABCD2345")).toBeNull();

        inviteLookup = [{ workerId: "wkr_1", name: "Casey", phoneNumber: "+13125550142", status: "inactive", organizationName: "Cafe Nord" }];
        expect(await getWorkerInviteByCode("ABCD2345")).toBeNull();
    });

    test("is nothing when it matches no one, or is blank", async () => {
        expect(await getWorkerInviteByCode("NOPE0000")).toBeNull();
        expect(await getWorkerInviteByCode("   ")).toBeNull();
    });
});

describe("signing in attaches the account to the invited worker", () => {
    test("links the worker, activates it and gives the account membership", async () => {
        invitedWorkers = [invited()];
        existingUser = { id: "user_1", name: "+13125550100" };

        const orgs = await syncWorkerMembershipsForPhone("user_1", "+13125550100");

        expect(orgs).toEqual(["org_1"]);
        expect(workerUpdates[0]).toMatchObject({ userId: "user_1", status: "active" });
        expect(memberInserts[0]).toMatchObject({ organizationId: "org_1", userId: "user_1", role: "member", status: "active" });
        // A user still named after their number takes the business's name for them.
        expect(userUpdates[0]).toMatchObject({ role: "worker", name: "Casey Lee" });
    });

    test("reactivates an existing membership instead of adding a second", async () => {
        invitedWorkers = [invited()];
        existingUser = { id: "user_1", name: "Casey" };
        membership = { id: "mem_1", status: "inactive" };

        await syncWorkerMembershipsForPhone("user_1", "+13125550100");

        expect(memberInserts).toHaveLength(0);
        expect(memberUpdates[0]).toMatchObject({ status: "active" });
    });

    test("never takes over a worker another account already signed in as", async () => {
        invitedWorkers = [invited({ status: "active", userId: "someone_else" })];
        existingUser = { id: "user_1", name: "Casey" };

        await syncWorkerMembershipsForPhone("user_1", "+13125550100");

        expect(workerUpdates).toHaveLength(0);
        expect(memberInserts).toHaveLength(0);
    });

    test("won't attach one account to two workers at the same business", async () => {
        invitedWorkers = [invited()];
        existingUser = { id: "user_1", name: "Casey" };
        stillLinked = { id: "wkr_older" };

        await syncWorkerMembershipsForPhone("user_1", "+13125550100");

        expect(workerUpdates).toHaveLength(0);
    });

    test("refuses a number nobody has invited", async () => {
        await expect(syncWorkerMembershipsForPhone("user_1", "+13125550100")).rejects.toThrow(
            "has not been invited",
        );
    });
});
