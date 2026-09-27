import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { db } from "@repo/database";
import {
    auditLog,
    location,
    member,
    organization,
    rosterEntry,
    scheduledNotification,
    shift,
    shiftAssignment,
    user,
} from "@repo/database/schema";
import { and, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { applySchedulerChanges } from "../src/modules/scheduler/changes";
import { previewSchedulerPublish, publishSchedulerWeek } from "../src/modules/scheduler/publish-week";
import { getWorkerAllShifts } from "../src/modules/time-tracking/worker-all-shifts";

/**
 * Publishing a week against a real database: staged changes become what staff
 * see, one message per affected person, and nothing staged leaks to staff
 * before then. Needs DATABASE_URL and RUN_DB_TESTS=true.
 */

const TZ = "America/New_York";
const tag = nanoid(6);
const ORG = `org_p${tag}`;
const LOC = `loc_p${tag}`;
const ANA = `usr_pa${tag}`;
const BEN = `usr_pb${tag}`;
const MARCO = `re_pm${tag}`;
const PUBLISHED = `shf_ppub${tag}`;
const WEEK = { locationId: LOC, weekStart: "2027-02-03" }; // week of Sun 31 Jan – Sat 6 Feb 2027

const ana = { personId: ANA, kind: "roster" as const };
const ben = { personId: BEN, kind: "roster" as const };
const marco = { personId: MARCO, kind: "invited" as const };
const newShiftId = () => `shf_${nanoid(16).replace(/[^0-9A-Za-z]/g, "x")}`;
const apply = (changes: unknown[]) => applySchedulerChanges({ orgId: ORG, actorId: ANA, body: { changes } });
const publish = (force = false) => publishSchedulerWeek({ orgId: ORG, actorId: ANA, body: { ...WEEK, force } });
const messagesFor = (workerId: string) =>
    db.query.scheduledNotification.findMany({
        where: and(eq(scheduledNotification.organizationId, ORG), eq(scheduledNotification.workerId, workerId), eq(scheduledNotification.type, "schedule_published")),
    });
const loadShift = (id: string) => db.query.shift.findFirst({ where: eq(shift.id, id), with: { assignments: true } });

const describeDb = process.env.RUN_DB_TESTS === "true" ? describe : describe.skip;

describeDb("Publishing a Scheduler week (database)", () => {
    beforeAll(async () => {
        const now = new Date();
        await db.insert(organization).values({ id: ORG, name: "Publish Bistro", createdAt: now, timezone: TZ });
        await db.insert(location).values({ id: LOC, organizationId: ORG, name: "Downtown", slug: `pdt-${tag}`, timezone: TZ, createdAt: now, updatedAt: now });
        await db.insert(user).values([
            { id: ANA, name: "Ana Ruiz", email: `pana-${tag}@example.com`, emailVerified: true, createdAt: now, updatedAt: now },
            { id: BEN, name: "Ben Kim", email: `pben-${tag}@example.com`, emailVerified: true, createdAt: now, updatedAt: now },
        ]);
        await db.insert(member).values([
            { id: `mem_pa${tag}`, userId: ANA, organizationId: ORG, role: "member", createdAt: now },
            { id: `mem_pb${tag}`, userId: BEN, organizationId: ORG, role: "member", createdAt: now },
        ] as never);
        await db.insert(rosterEntry).values({ id: MARCO, organizationId: ORG, name: "Marco Bell", email: `pmarco-${tag}@example.com`, createdAt: now } as never);
    });

    beforeEach(async () => {
        await db.delete(scheduledNotification).where(eq(scheduledNotification.organizationId, ORG));
        await db.delete(shift).where(eq(shift.organizationId, ORG));
        // Tue 2 Feb 4p–11p, published, Ana on it, with her reminders already queued.
        await db.insert(shift).values({
            id: PUBLISHED,
            organizationId: ORG,
            locationId: LOC,
            title: "Server",
            timezone: TZ,
            startTime: new Date("2027-02-02T21:00:00Z"),
            endTime: new Date("2027-02-03T04:00:00Z"),
            capacityTotal: 2,
            status: "published",
            breakMinutes: 30,
        });
        await db.insert(shiftAssignment).values({ id: `asg_pp${nanoid(8)}`, shiftId: PUBLISHED, workerId: ANA, status: "active" });
        await db.insert(scheduledNotification).values({
            id: nanoid(),
            workerId: ANA,
            shiftId: PUBLISHED,
            organizationId: ORG,
            type: "night_before",
            title: "Shift Tomorrow",
            body: "…",
            scheduledAt: new Date("2027-02-02T01:00:00Z"),
            status: "pending",
        });
    });

    afterAll(async () => {
        await db.delete(scheduledNotification).where(eq(scheduledNotification.organizationId, ORG));
        await db.delete(shift).where(eq(shift.organizationId, ORG));
        await db.delete(auditLog).where(eq(auditLog.organizationId, ORG));
        await db.delete(rosterEntry).where(eq(rosterEntry.organizationId, ORG));
        await db.delete(member).where(eq(member.organizationId, ORG));
        await db.delete(location).where(eq(location.organizationId, ORG));
        await db.delete(user).where(inArray(user.id, [ANA, BEN]));
        await db.delete(organization).where(eq(organization.id, ORG));
    });

    test("staff don't see staged people until the week is published", async () => {
        await apply([{ op: "assign", shiftId: PUBLISHED, assignees: [ana, ben] }]);
        const before = await getWorkerAllShifts(BEN, { status: "all", orgId: ORG });
        expect(before.shifts.map((s: { id: string }) => s.id)).not.toContain(PUBLISHED);

        await publish();
        const after = await getWorkerAllShifts(BEN, { status: "all", orgId: ORG });
        expect(after.shifts.map((s: { id: string }) => s.id)).toContain(PUBLISHED);
    });

    test("the preview is what publishing does, including who can't be reached", async () => {
        const draft = newShiftId();
        await apply([
            { op: "create", shiftId: draft, shift: { locationId: LOC, localDate: "2027-02-04", startLocal: "09:00", endLocal: "17:00", role: "Server", capacity: 3 }, assignees: [ben, marco] },
            { op: "update", shiftId: PUBLISHED, patch: { startLocal: "17:00" } },
        ]);

        const preview = await previewSchedulerPublish({ orgId: ORG, body: WEEK });
        expect(preview).toMatchObject({ newShifts: 1, changedShifts: 1, removedShifts: 0, openSlots: 2, conflicts: [], expiredDrafts: 0 });
        expect(preview.notify.map((p) => [p.name, p.added, p.changed, p.removed])).toEqual([
            ["Ana Ruiz", 0, 1, 0],
            ["Ben Kim", 1, 0, 0],
        ]);
        expect(preview.unreachable.map((p) => p.name)).toEqual(["Marco Bell"]);

        const result = await publish();
        expect(result).toMatchObject({ newShifts: 1, changedShifts: 1, removedShifts: 0 });
        expect((await publishSchedulerWeek({ orgId: ORG, actorId: ANA, body: WEEK })).newShifts).toBe(0); // nothing left to publish
    });

    test("drafts go live, staged edits apply, and each person gets one message", async () => {
        const draft = newShiftId();
        await apply([
            { op: "create", shiftId: draft, shift: { locationId: LOC, localDate: "2027-02-04", startLocal: "09:00", endLocal: "17:00", role: "Server" }, assignees: [ben] },
            { op: "update", shiftId: PUBLISHED, patch: { startLocal: "17:00" } },
        ]);
        await publish();

        const created = await loadShift(draft);
        expect(created).toMatchObject({ status: "assigned", pendingPatch: null });
        expect(created!.publishedAt).toBeInstanceOf(Date);
        const moved = await loadShift(PUBLISHED);
        expect(moved!.startTime.toISOString()).toBe("2027-02-02T22:00:00.000Z");
        expect(moved!.pendingPatch).toBeNull();

        const [benMessage, ...moreForBen] = await messagesFor(BEN);
        expect(moreForBen).toHaveLength(0);
        expect(benMessage).toMatchObject({ title: "You're on the schedule", body: "Downtown, Jan 31 – Feb 6: 1 new shift. Open the app to see your shifts." });
        expect((await messagesFor(ANA))[0]!.body).toContain("1 changed");

        // Ben's reminders exist, without the old per-shift "new shift" push; Ana's were rebuilt for the new time.
        const benReminders = await db.query.scheduledNotification.findMany({ where: and(eq(scheduledNotification.shiftId, draft), eq(scheduledNotification.workerId, BEN)) });
        expect(benReminders.length).toBeGreaterThan(0);
        expect(benReminders.some((n) => n.type === "assignment_created")).toBe(false);
        const anaOld = await db.query.scheduledNotification.findMany({ where: and(eq(scheduledNotification.shiftId, PUBLISHED), eq(scheduledNotification.body, "…")) });
        expect(anaOld).toHaveLength(0);
    });

    test("people coming off and shifts being removed are told, and their reminders stop", async () => {
        const draft = newShiftId();
        await apply([{ op: "create", shiftId: draft, shift: { locationId: LOC, localDate: "2027-02-05", startLocal: "09:00", endLocal: "17:00", role: "Server" }, assignees: [ana] }]);
        await publish();
        await db.delete(scheduledNotification).where(and(eq(scheduledNotification.organizationId, ORG), eq(scheduledNotification.type, "schedule_published")));

        await apply([
            { op: "assign", shiftId: PUBLISHED, assignees: [ben] }, // Ana off Tuesday, Ben on
            { op: "delete", shiftId: draft }, // Friday removed
        ]);
        await publish();

        const tuesday = await loadShift(PUBLISHED);
        expect(tuesday!.assignments.map((a) => [a.workerId, a.status, a.pendingState]).sort()).toEqual(
            [[ANA, "removed", null], [BEN, "active", null]].sort(),
        );
        const friday = await loadShift(draft);
        expect(friday!.status).toBe("cancelled");

        expect((await messagesFor(ANA))[0]).toMatchObject({ title: "Your schedule changed", body: "Downtown, Jan 31 – Feb 6: 2 removed. Open the app to see your shifts." });
        const anaPending = await db.query.scheduledNotification.findMany({
            where: and(eq(scheduledNotification.workerId, ANA), eq(scheduledNotification.status, "pending"), inArray(scheduledNotification.shiftId, [PUBLISHED, draft])),
        });
        expect(anaPending).toHaveLength(0);
    });

    test("publishing past a double-booking needs force, and is audited", async () => {
        await apply([{ op: "update", shiftId: PUBLISHED, patch: { capacity: 2 } }]);
        await applySchedulerChanges({
            orgId: ORG,
            actorId: ANA,
            body: {
                force: true,
                changes: [{ op: "create", shiftId: newShiftId(), shift: { locationId: LOC, localDate: "2027-02-02", startLocal: "18:00", endLocal: "22:00", role: "Host" }, assignees: [ana] }],
            },
        });

        await expect(publish()).rejects.toMatchObject({ code: "SCHEDULE_CONFLICT", statusCode: 409 });
        const result = await publish(true);
        // Only shifts being published are checked: the new Host shift, not Ana's unchanged Tuesday.
        expect(result.conflicts.map((c) => [c.personName, c.messages])).toEqual([["Ana Ruiz", ["Already on Tue 4p–11p Server"]]]);
        const audit = await db.query.auditLog.findFirst({ where: and(eq(auditLog.organizationId, ORG), eq(auditLog.action, "schedule.published")) });
        expect(audit).toBeDefined();
    });
});
