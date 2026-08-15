import { describe, test, expect, mock, beforeEach } from "bun:test";

let shiftRow: Record<string, unknown> | undefined;
let assignmentRow: Record<string, unknown> | undefined;
let rateRow: Record<string, unknown> | undefined;
let shiftUpdate: Record<string, unknown> = {};
let assignmentUpdate: Record<string, unknown> = {};
const audits: Record<string, unknown>[] = [];

/**
 * The real schema objects are left alone (mocking that module breaks every
 * other importer), so writes are told apart by where they happen: issuing a
 * code updates the shift directly, clocking in updates the assignment inside a
 * transaction.
 */
const captureInto = (sink: (values: Record<string, unknown>) => void) => () => ({
    set: (values: Record<string, unknown>) => {
        sink(values);
        return { where: () => Promise.resolve() };
    },
});

const mockDb = {
    query: {
        shift: { findFirst: mock(() => Promise.resolve(shiftRow)) },
        shiftAssignment: { findFirst: mock(() => Promise.resolve(assignmentRow)) },
        rateLimitState: { findFirst: mock(() => Promise.resolve(rateRow)) },
    },
    update: captureInto((v) => {
        shiftUpdate = v;
    }),
    insert: () => ({
        values: () => ({ onConflictDoUpdate: () => Promise.resolve() }),
    }),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
            update: captureInto((v) => {
                assignmentUpdate = v;
            }),
            insert: () => ({ values: () => Promise.resolve() }),
        }),
};

mock.module("@repo/database", () => ({
    db: mockDb,
    logAudit: mock(async (e: Record<string, unknown>) => {
        audits.push(e);
    }),
}));

const { getSiteCode, clockInWithSiteCode } = await import("../src/services/site-code");

const ORG = "org_1";
const WORKER = "user_worker";
const FUTURE = new Date(Date.now() + 3_600_000);

describe("issuing a site code", () => {
    beforeEach(() => {
        shiftUpdate = {};
        audits.length = 0;
        shiftRow = { id: "shf_1", status: "published", siteCode: null, siteCodeIssuedAt: null };
    });

    test("issues four digits and records who asked", async () => {
        const result = await getSiteCode("shf_1", ORG, "user_manager");

        expect(result.code).toMatch(/^\d{4}$/);
        expect(result.reused).toBe(false);
        expect(shiftUpdate.siteCode).toBe(result.code);
        expect(audits[0]!.action).toBe("shift.site_code_issued");
    });

    test("asking twice gives the same digits, not new ones", async () => {
        shiftRow = { id: "shf_1", status: "published", siteCode: "0421", siteCodeIssuedAt: new Date() };

        const result = await getSiteCode("shf_1", ORG, "user_manager");

        expect(result.code).toBe("0421");
        expect(result.reused).toBe(true);
        // A code already written on someone's hand must not be invalidated.
        expect(shiftUpdate.siteCode).toBeUndefined();
    });

    test("a cancelled shift has no code to give", async () => {
        shiftRow = { id: "shf_1", status: "cancelled", siteCode: null };

        await expect(getSiteCode("shf_1", ORG, "user_manager")).rejects.toThrow(/no code/);
    });
});

describe("clocking in with a site code", () => {
    beforeEach(() => {
        assignmentUpdate = {};
        audits.length = 0;
        rateRow = undefined;
        shiftRow = { id: "shf_1", status: "published", siteCode: "0421", startTime: FUTURE, title: "Loader" };
        assignmentRow = { id: "asg_1", actualClockIn: null };
    });

    test("the right code clocks you in, unverified and flagged", async () => {
        const result = await clockInWithSiteCode({ shiftId: "shf_1", code: "0421" }, WORKER, ORG);

        expect(result.success).toBe(true);
        expect(assignmentUpdate.clockInMethod).toBe("site_code");
        expect(assignmentUpdate.clockInVerified).toBe(false);
        // The manager must see every use — that is what makes the shortcut safe.
        expect(assignmentUpdate.needsReview).toBe(true);
        expect(audits[0]!.action).toBe("shift_assignment.site_code_clock_in");
    });

    test("turning up early does not start the clock early", async () => {
        await clockInWithSiteCode({ shiftId: "shf_1", code: "0421" }, WORKER, ORG);

        // actual is now, effective is snapped to the scheduled start
        expect((assignmentUpdate.effectiveClockIn as Date).getTime()).toBe(FUTURE.getTime());
        expect((assignmentUpdate.actualClockIn as Date).getTime()).toBeLessThan(FUTURE.getTime());
    });

    test("the wrong code does not clock you in", async () => {
        await expect(
            clockInWithSiteCode({ shiftId: "shf_1", code: "9999" }, WORKER, ORG),
        ).rejects.toThrow(/does not match/);
        expect(assignmentUpdate.clockInMethod).toBeUndefined();
    });

    test("a shift with no code issued cannot be guessed into", async () => {
        shiftRow = { ...shiftRow, siteCode: null };

        await expect(
            clockInWithSiteCode({ shiftId: "shf_1", code: "0000" }, WORKER, ORG),
        ).rejects.toThrow(/does not match/);
    });

    test("stops guessing after five tries", async () => {
        rateRow = { key: "k", count: 5, windowStart: String(Date.now()) };

        await expect(
            clockInWithSiteCode({ shiftId: "shf_1", code: "0421" }, WORKER, ORG),
        ).rejects.toThrow(/Too many tries/);
        // Even the correct code is refused once the budget is spent.
        expect(assignmentUpdate.clockInMethod).toBeUndefined();
    });

    test("the attempt budget refills after the window", async () => {
        rateRow = { key: "k", count: 5, windowStart: String(Date.now() - 20 * 60 * 1000) };

        const result = await clockInWithSiteCode({ shiftId: "shf_1", code: "0421" }, WORKER, ORG);

        expect(result.success).toBe(true);
    });

    test("someone not on the shift cannot use the code", async () => {
        assignmentRow = undefined;

        await expect(
            clockInWithSiteCode({ shiftId: "shf_1", code: "0421" }, WORKER, ORG),
        ).rejects.toThrow(/not on this shift/);
    });

    test("will not clock you in twice", async () => {
        assignmentRow = { id: "asg_1", actualClockIn: new Date() };

        await expect(
            clockInWithSiteCode({ shiftId: "shf_1", code: "0421" }, WORKER, ORG),
        ).rejects.toThrow(/already clocked in/);
    });

    test("rejects anything that is not four digits", async () => {
        await expect(
            clockInWithSiteCode({ shiftId: "shf_1", code: "42" }, WORKER, ORG),
        ).rejects.toThrow(/Invalid request/);
    });
});
