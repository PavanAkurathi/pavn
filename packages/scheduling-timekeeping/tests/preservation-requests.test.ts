import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { db } from "@repo/database";
import {
    auditLog,
    location,
    member,
    organization,
    scheduledNotification,
    shift,
    shiftAssignment,
    shiftRequest,
    timeOffRequest,
    user,
    workerRole,
} from "@repo/database/schema";
import { and, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { decideRequest, listManagerRequests } from "../src/modules/requests/manager";
import { actOnRequest, createShiftRequest, createTimeOff, listOpenShifts, listSwapCandidates, listWorkerRequests } from "../src/modules/requests/worker";

/**
 * Requests against a real database: claims, drops, swaps and time off, from
 * the worker asking to the manager deciding, and what each does to the
 * schedule. Needs DATABASE_URL and RUN_DB_TESTS=true.
 */

const TZ = "America/New_York";
const tag = nanoid(6);
const ORG = `org_r${tag}`;
const LOC = `loc_r${tag}`;
const ANA = `usr_ra${tag}`;
const BEN = `usr_rb${tag}`;
const CARA = `usr_rc${tag}`;
const BOSS = `usr_rm${tag}`;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Future shifts, on the hour, so nothing has started.
const base = new Date(Math.ceil((Date.now() + 3 * DAY) / HOUR) * HOUR);
const at = (dayOffset: number, hour: number) => new Date(base.getTime() + dayOffset * DAY + hour * HOUR);

async function addShift(input: { start: Date; hours?: number; capacity?: number; role?: string; people?: string[]; staged?: string[] }) {
    const id = `shf_${nanoid(16).replace(/[^0-9A-Za-z]/g, "x")}`;
    const people = input.people ?? [];
    const capacity = input.capacity ?? 1;
    await db.insert(shift).values({
        id,
        organizationId: ORG,
        locationId: LOC,
        title: input.role ?? "Server",
        timezone: TZ,
        startTime: input.start,
        endTime: new Date(input.start.getTime() + (input.hours ?? 6) * HOUR),
        capacityTotal: capacity,
        status: people.length >= capacity ? "assigned" : "published",
        breakMinutes: 0,
        publishedAt: new Date(),
    });
    const rows = [
        ...people.map((workerId) => ({ id: `asg_${nanoid(10)}`, shiftId: id, workerId, status: "active", pendingState: null })),
        ...(input.staged ?? []).map((workerId) => ({ id: `asg_${nanoid(10)}`, shiftId: id, workerId, status: "active", pendingState: "add" })),
    ];
    if (rows.length) await db.insert(shiftAssignment).values(rows);
    return id;
}

const assignmentsOf = async (shiftId: string) =>
    (await db.query.shiftAssignment.findMany({ where: eq(shiftAssignment.shiftId, shiftId) }))
        .map((a) => [a.workerId, a.status, a.pendingState] as const)
        .sort();
const messagesFor = (workerId: string) =>
    db.query.scheduledNotification.findMany({
        where: and(eq(scheduledNotification.organizationId, ORG), eq(scheduledNotification.workerId, workerId), inArray(scheduledNotification.type, ["request_update", "swap_offer"])),
    });
const decide = (id: string, decision: "approve" | "decline", body: unknown = {}) => decideRequest({ orgId: ORG, actorId: BOSS, id, decision, body });
const setPolicy = (values: { openShiftClaimPolicy?: string; swapApprovalRequired?: boolean }) => db.update(organization).set(values).where(eq(organization.id, ORG));

const describeDb = process.env.RUN_DB_TESTS === "true" ? describe : describe.skip;

describeDb("Requests (database)", () => {
    beforeAll(async () => {
        const now = new Date();
        await db.insert(organization).values({ id: ORG, name: "Request Bistro", createdAt: now, timezone: TZ });
        await db.insert(location).values({ id: LOC, organizationId: ORG, name: "Downtown", slug: `rdt-${tag}`, timezone: TZ, createdAt: now, updatedAt: now });
        await db.insert(user).values(
            [
                [ANA, "Ana Ruiz"],
                [BEN, "Ben Kim"],
                [CARA, "Cara Diaz"],
                [BOSS, "Mia Boss"],
            ].map(([id, name]) => ({ id: id!, name: name!, email: `${id}@example.com`, emailVerified: true, createdAt: now, updatedAt: now })),
        );
        await db.insert(member).values([
            { id: `mem_a${tag}`, userId: ANA, organizationId: ORG, role: "member", createdAt: now },
            { id: `mem_b${tag}`, userId: BEN, organizationId: ORG, role: "member", createdAt: now },
            { id: `mem_c${tag}`, userId: CARA, organizationId: ORG, role: "member", createdAt: now },
            { id: `mem_m${tag}`, userId: BOSS, organizationId: ORG, role: "admin", createdAt: now },
        ] as never);
        await db.insert(workerRole).values([
            { id: `wr_a${tag}`, workerId: ANA, organizationId: ORG, role: "Server" },
            { id: `wr_b${tag}`, workerId: BEN, organizationId: ORG, role: "Server" },
            { id: `wr_c${tag}`, workerId: CARA, organizationId: ORG, role: "Line Cook" },
        ]);
    });

    beforeEach(async () => {
        await db.delete(scheduledNotification).where(eq(scheduledNotification.organizationId, ORG));
        await db.delete(shiftRequest).where(eq(shiftRequest.organizationId, ORG));
        await db.delete(timeOffRequest).where(eq(timeOffRequest.organizationId, ORG));
        await db.delete(shift).where(eq(shift.organizationId, ORG));
        await setPolicy({ openShiftClaimPolicy: "approval", swapApprovalRequired: true });
    });

    afterAll(async () => {
        await db.delete(scheduledNotification).where(eq(scheduledNotification.organizationId, ORG));
        await db.delete(shiftRequest).where(eq(shiftRequest.organizationId, ORG));
        await db.delete(timeOffRequest).where(eq(timeOffRequest.organizationId, ORG));
        await db.delete(shift).where(eq(shift.organizationId, ORG));
        await db.delete(auditLog).where(eq(auditLog.organizationId, ORG));
        await db.delete(workerRole).where(eq(workerRole.organizationId, ORG));
        await db.delete(member).where(eq(member.organizationId, ORG));
        await db.delete(location).where(eq(location.organizationId, ORG));
        await db.delete(user).where(inArray(user.id, [ANA, BEN, CARA, BOSS]));
        await db.delete(organization).where(eq(organization.id, ORG));
    });

    test("an open spot waits for a manager, who sees what approving does", async () => {
        const open = await addShift({ start: at(0, 16), capacity: 2 });

        const forAna = await listOpenShifts({ workerId: ANA });
        expect(forAna.shifts.map((s) => [s.shift.id, s.openSlots, s.claimPolicy])).toEqual([[open, 2, "approval"]]);
        expect((await listOpenShifts({ workerId: CARA })).shifts).toHaveLength(0); // a cook isn't offered a server shift

        const asked = await createShiftRequest({ workerId: ANA, body: { type: "claim", shiftId: open } });
        expect(asked.status).toBe("pending_manager");
        expect((await listOpenShifts({ workerId: ANA })).shifts[0]!.pendingRequestId).toBe(asked.id);
        expect((await createShiftRequest({ workerId: ANA, body: { type: "claim", shiftId: open } })).id).toBe(asked.id); // asking twice is one request

        const { requests, pendingCount } = await listManagerRequests({ orgId: ORG, query: {} });
        expect(pendingCount).toBe(1);
        expect(requests[0]).toMatchObject({ id: asked.id, kind: "claim", requester: { name: "Ana Ruiz" }, conflicts: [] });
        expect(requests[0]!.impact).toEqual(["Takes 1 of 2 open Server spots", "Ana Ruiz would be at 6h this week"]);

        expect(await decide(asked.id, "approve")).toEqual({ id: asked.id, status: "approved" });
        expect(await assignmentsOf(open)).toEqual([[ANA, "active", null]]);
        expect((await db.query.shift.findFirst({ where: eq(shift.id, open) }))!.status).toBe("published"); // one spot still open
        expect((await messagesFor(ANA)).map((m) => m.title)).toEqual(["The shift is yours"]);
        const reminders = await db.query.scheduledNotification.findMany({ where: and(eq(scheduledNotification.shiftId, open), eq(scheduledNotification.workerId, ANA)) });
        expect(reminders.length).toBeGreaterThan(0);
        await expect(decide(asked.id, "approve")).rejects.toMatchObject({ code: "REQUEST_NOT_PENDING" });
    });

    test("first to claim gets it when the workplace allows", async () => {
        await setPolicy({ openShiftClaimPolicy: "auto" });
        const open = await addShift({ start: at(1, 16) });

        const claimed = await createShiftRequest({ workerId: ANA, body: { type: "claim", shiftId: open } });
        expect(claimed).toMatchObject({ status: "approved" });
        expect((await db.query.shift.findFirst({ where: eq(shift.id, open) }))!.status).toBe("assigned");
        await expect(createShiftRequest({ workerId: BEN, body: { type: "claim", shiftId: open } })).rejects.toMatchObject({ code: "SHIFT_FULL", statusCode: 409 });
        expect((await listOpenShifts({ workerId: BEN })).shifts).toHaveLength(0);
    });

    test("people staged onto a shift take its spot before it's published", async () => {
        await addShift({ start: at(1, 9), staged: [BEN] });
        expect((await listOpenShifts({ workerId: ANA })).shifts).toHaveLength(0);
    });

    test("claims onto a double-booking are refused; approving one needs force and is audited", async () => {
        const open = await addShift({ start: at(2, 18), hours: 4 });
        const asked = await createShiftRequest({ workerId: ANA, body: { type: "claim", shiftId: open } });
        await addShift({ start: at(2, 16), people: [ANA] }); // booked afterwards

        const later = await addShift({ start: at(2, 17), hours: 2, capacity: 2 });
        const listed = (await listOpenShifts({ workerId: ANA })).shifts.find((s) => s.shift.id === later)!;
        expect(listed.conflict).toMatch(/^You're on Server .* at Request Bistro$/);
        await expect(createShiftRequest({ workerId: ANA, body: { type: "claim", shiftId: later } })).rejects.toMatchObject({ code: "SCHEDULE_CONFLICT" });

        const pending = (await listManagerRequests({ orgId: ORG, query: {} })).requests.find((r) => r.id === asked.id)!;
        expect(pending.conflicts[0]).toMatch(/^Already on /);
        await expect(decide(asked.id, "approve")).rejects.toMatchObject({ code: "SCHEDULE_CONFLICT", statusCode: 409 });
        await decide(asked.id, "approve", { force: true });
        expect(await assignmentsOf(open)).toEqual([[ANA, "active", null]]);
        const override = await db.query.auditLog.findFirst({ where: and(eq(auditLog.organizationId, ORG), eq(auditLog.action, "schedule.conflict_override")) });
        expect(override).toBeDefined();
    });

    test("an approved drop frees the spot and stops the reminders", async () => {
        const mine = await addShift({ start: at(3, 16), people: [ANA] });
        await db.insert(scheduledNotification).values({
            id: nanoid(),
            workerId: ANA,
            shiftId: mine,
            organizationId: ORG,
            type: "night_before",
            title: "Shift Tomorrow",
            body: "…",
            scheduledAt: at(2, 20),
            status: "pending",
        });
        await expect(createShiftRequest({ workerId: BEN, body: { type: "drop", shiftId: mine } })).rejects.toMatchObject({ code: "NOT_ON_SHIFT" });

        const asked = await createShiftRequest({ workerId: ANA, body: { type: "drop", shiftId: mine, note: "Exam that night" } });
        expect(asked.status).toBe("pending_manager");
        const listed = (await listManagerRequests({ orgId: ORG, query: {} })).requests[0]!;
        expect(listed).toMatchObject({ kind: "drop", note: "Exam that night" });
        expect(listed.impact[0]).toMatch(/^Opens 1 Server spot, /);

        await decide(asked.id, "approve");
        expect(await assignmentsOf(mine)).toEqual([[ANA, "removed", null]]);
        expect((await db.query.shift.findFirst({ where: eq(shift.id, mine) }))!.status).toBe("published");
        const reminders = await db.query.scheduledNotification.findMany({ where: eq(scheduledNotification.shiftId, mine) });
        expect(reminders.map((r) => r.status)).toEqual(["cancelled"]);
        expect((await messagesFor(ANA)).map((m) => m.title)).toEqual(["You're off the shift"]);
        expect((await listOpenShifts({ workerId: BEN })).shifts.map((s) => s.shift.id)).toEqual([mine]);
    });

    test("a swap goes to the coworker, then the manager", async () => {
        const mine = await addShift({ start: at(4, 16), people: [ANA] });

        const candidates = await listSwapCandidates({ workerId: ANA, shiftId: mine });
        expect(candidates.people.map((p) => [p.name, p.conflict])).toEqual([["Ben Kim", null]]); // Cara isn't a server
        await expect(createShiftRequest({ workerId: ANA, body: { type: "swap", shiftId: mine, targetWorkerId: CARA } })).rejects.toMatchObject({
            code: "ROLE_MISMATCH",
        });

        const offered = await createShiftRequest({ workerId: ANA, body: { type: "swap", shiftId: mine, targetWorkerId: BEN } });
        expect(offered.status).toBe("pending_peer");
        expect((await messagesFor(BEN)).map((m) => [m.type, m.title])).toEqual([["swap_offer", "Ana Ruiz asked you to take a shift"]]);
        expect((await listManagerRequests({ orgId: ORG, query: {} })).pendingCount).toBe(0); // not the manager's turn yet

        const forBen = (await listWorkerRequests({ workerId: BEN })).requests[0]!;
        expect(forBen).toMatchObject({ id: offered.id, direction: "received", canRespond: true, otherPerson: { name: "Ana Ruiz" } });
        await expect(actOnRequest({ workerId: CARA, id: offered.id, action: "accept" })).rejects.toMatchObject({ code: "REQUEST_NOT_FOUND" });

        expect(await actOnRequest({ workerId: BEN, id: offered.id, action: "accept" })).toMatchObject({ status: "pending_manager" });
        const listed = (await listManagerRequests({ orgId: ORG, query: {} })).requests[0]!;
        expect(listed).toMatchObject({ kind: "swap", target: { name: "Ben Kim" } });
        expect(listed.impact[0]).toBe("Ben Kim takes it and Ana Ruiz comes off");

        await decide(offered.id, "approve");
        expect(await assignmentsOf(mine)).toEqual([[ANA, "removed", null], [BEN, "active", null]].sort() as never);
        expect((await messagesFor(ANA)).map((m) => m.title)).toContain("Swap approved");
        expect((await messagesFor(BEN)).map((m) => m.title)).toContain("Swap approved: the shift is yours");
    });

    test("without swap approval, the coworker's yes is enough", async () => {
        await setPolicy({ swapApprovalRequired: false });
        const mine = await addShift({ start: at(5, 9), people: [ANA] });
        const offered = await createShiftRequest({ workerId: ANA, body: { type: "swap", shiftId: mine, targetWorkerId: BEN } });
        expect(await actOnRequest({ workerId: BEN, id: offered.id, action: "accept" })).toMatchObject({ status: "approved" });
        expect(await assignmentsOf(mine)).toEqual([[ANA, "removed", null], [BEN, "active", null]].sort() as never);
    });

    test("a declined or cancelled swap changes nothing and tells the other person", async () => {
        const mine = await addShift({ start: at(5, 16), people: [ANA] });
        const first = await createShiftRequest({ workerId: ANA, body: { type: "swap", shiftId: mine, targetWorkerId: BEN } });
        await actOnRequest({ workerId: BEN, id: first.id, action: "decline" });
        expect((await messagesFor(ANA)).map((m) => m.title)).toEqual(["Ben Kim can't take your shift"]);

        const second = await createShiftRequest({ workerId: ANA, body: { type: "swap", shiftId: mine, targetWorkerId: BEN } });
        await actOnRequest({ workerId: ANA, id: second.id, action: "cancel" });
        expect((await messagesFor(BEN)).map((m) => m.title)).toContain("Ana Ruiz took back their swap");
        expect(await assignmentsOf(mine)).toEqual([[ANA, "active", null]]);
    });

    test("time off: asked, approved, then it keeps you off open shifts", async () => {
        const open = await addShift({ start: at(6, 12) });
        const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(at(6, 12));

        const sent = await createTimeOff({ workerId: ANA, body: { allDay: true, startDate: localDate, endDate: localDate, reason: "Wedding" } });
        expect(sent.ids).toHaveLength(1);
        await expect(createTimeOff({ workerId: ANA, body: { allDay: true, startDate: localDate, endDate: localDate } })).rejects.toMatchObject({
            code: "TIME_OFF_EXISTS",
        });

        const listed = (await listManagerRequests({ orgId: ORG, query: {} })).requests[0]!;
        expect(listed).toMatchObject({ kind: "time_off", note: "Wedding", impact: ["Nothing scheduled then"] });
        await decide(sent.ids[0]!, "approve", { note: "Enjoy" });
        expect((await messagesFor(ANA))[0]).toMatchObject({ title: "Time off approved" });
        expect((await messagesFor(ANA))[0]!.body).toContain("Enjoy");

        expect((await listOpenShifts({ workerId: ANA })).shifts.find((s) => s.shift.id === open)!.conflict).toBe("You're off then");
        await expect(createShiftRequest({ workerId: ANA, body: { type: "claim", shiftId: open } })).rejects.toMatchObject({ code: "SCHEDULE_CONFLICT" });

        const mineNow = (await listWorkerRequests({ workerId: ANA })).requests.find((r) => r.id === sent.ids[0])!;
        expect(mineNow).toMatchObject({ kind: "time_off", status: "approved", managerNote: "Enjoy", canCancel: true });
        await actOnRequest({ workerId: ANA, id: sent.ids[0]!, action: "cancel" });
        expect((await listOpenShifts({ workerId: ANA })).shifts.find((s) => s.shift.id === open)!.conflict).toBeNull();
    });

    test("requests for shifts that have started expire", async () => {
        const started = await addShift({ start: new Date(Date.now() - HOUR), people: [ANA] });
        const id = `req_${nanoid(12).replace(/[^0-9A-Za-z]/g, "x")}`;
        await db.insert(shiftRequest).values({ id, organizationId: ORG, type: "drop", shiftId: started, requesterWorkerId: ANA, status: "pending_manager" });

        expect((await listManagerRequests({ orgId: ORG, query: {} })).pendingCount).toBe(0);
        expect((await db.query.shiftRequest.findFirst({ where: eq(shiftRequest.id, id) }))!.status).toBe("expired");
        await expect(decide(id, "approve")).rejects.toMatchObject({ code: "REQUEST_NOT_PENDING" });
    });
});
