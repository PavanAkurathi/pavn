import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { db } from "@repo/database";
import {
    auditLog,
    location,
    member,
    organization,
    scheduleEvent,
    shift,
    shiftAssignment,
    timeOffRequest,
    user,
    worker,
} from "@repo/database/schema";
import { and, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { applySchedulerChanges, discardSchedulerWeek } from "../src/modules/scheduler/changes";

/**
 * The Scheduler's edit engine against a real database: drafts change
 * directly, published shifts stage their changes, every batch can be undone,
 * and double-bookings need an explicit override. Needs DATABASE_URL and
 * RUN_DB_TESTS=true.
 */

const TZ = "America/New_York";
const tag = nanoid(6);
const ORG = `org_t${tag}`;
const OTHER_ORG = `org_o${tag}`;
const LOC = `loc_t${tag}`;
// Accounts (who signs in, who requests time off) and the workers they are at this business.
const USER_ANA = `usr_a${tag}`;
const USER_BEN = `usr_b${tag}`;
const ANA = `wkr_a${tag}`;
const BEN = `wkr_b${tag}`;
const MARCO = `wkr_m${tag}`; // invited to the app, never signed in
const TEMP = `wkr_t${tag}`; // agency temp
const PUBLISHED = `shf_pub${tag}`;
const FOREIGN = `shf_for${tag}`;

const newShiftId = () => `shf_${nanoid(16).replace(/[^0-9A-Za-z]/g, "x")}`;
const ana = { personId: ANA };
const ben = { personId: BEN };
const marco = { personId: MARCO };
const temp = { personId: TEMP };
const apply = (changes: unknown[], force = false) =>
    applySchedulerChanges({ orgId: ORG, actorId: USER_ANA, body: { changes, force } });
const draftFields = (over: Record<string, unknown> = {}) => ({
    locationId: LOC,
    localDate: "2027-02-03", // Wednesday
    startLocal: "16:00",
    endLocal: "23:00",
    role: "Server",
    capacity: 2,
    ...over,
});

async function loadShift(id: string) {
    return db.query.shift.findFirst({ where: eq(shift.id, id), with: { assignments: true } });
}

const describeDb = process.env.RUN_DB_TESTS === "true" ? describe : describe.skip;

describeDb("Scheduler changes (database)", () => {
    beforeAll(async () => {
        const now = new Date();
        await db.insert(organization).values([
            { id: ORG, name: "Test Bistro", createdAt: now, timezone: TZ },
            { id: OTHER_ORG, name: "Other", createdAt: now, timezone: TZ },
        ]);
        await db.insert(location).values({ id: LOC, organizationId: ORG, name: "Downtown", slug: `dt-${tag}`, timezone: TZ, createdAt: now, updatedAt: now });
        await db.insert(user).values([
            { id: USER_ANA, name: "Ana Ruiz", email: `ana-${tag}@example.com`, emailVerified: true, createdAt: now, updatedAt: now },
            { id: USER_BEN, name: "Ben Kim", email: `ben-${tag}@example.com`, emailVerified: true, createdAt: now, updatedAt: now },
        ]);
        await db.insert(member).values([
            { id: `mem_a${tag}`, userId: USER_ANA, organizationId: ORG, role: "member", createdAt: now },
            { id: `mem_b${tag}`, userId: USER_BEN, organizationId: ORG, role: "member", createdAt: now },
        ] as never);
        await db.insert(worker).values([
            { id: ANA, organizationId: ORG, userId: USER_ANA, name: "Ana Ruiz", status: "active" },
            { id: BEN, organizationId: ORG, userId: USER_BEN, name: "Ben Kim", status: "active" },
            { id: MARCO, organizationId: ORG, name: "Marco Bell", status: "invited" },
            { id: TEMP, organizationId: ORG, name: "Jordan Fox", employmentType: "agency", agency: "StaffPlus" },
        ]);
        // Ben has Friday off.
        await db.insert(timeOffRequest).values({
            id: `tor_${tag}`,
            organizationId: ORG,
            workerId: USER_BEN,
            startTime: new Date("2027-02-05T05:00:00Z"),
            endTime: new Date("2027-02-06T05:00:00Z"),
            allDay: true,
            status: "approved",
        });
        await db.insert(shift).values({
            id: FOREIGN,
            organizationId: OTHER_ORG,
            title: "Server",
            startTime: new Date("2027-02-03T21:00:00Z"),
            endTime: new Date("2027-02-04T04:00:00Z"),
            status: "draft",
        });
    });

    beforeEach(async () => {
        // A published Tuesday 4p–11p shift with Ana on it, reset before each test.
        await db.delete(shift).where(and(eq(shift.organizationId, ORG)));
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
        await db.insert(shiftAssignment).values({ id: `asg_p${nanoid(8)}`, shiftId: PUBLISHED, workerId: ANA, status: "active" });
    });

    afterAll(async () => {
        await db.delete(shift).where(inArray(shift.organizationId, [ORG, OTHER_ORG]));
        await db.delete(timeOffRequest).where(eq(timeOffRequest.organizationId, ORG));
        await db.delete(auditLog).where(eq(auditLog.organizationId, ORG));
        await db.delete(worker).where(eq(worker.organizationId, ORG));
        await db.delete(member).where(eq(member.organizationId, ORG));
        await db.delete(location).where(eq(location.organizationId, ORG));
        await db.delete(user).where(inArray(user.id, [USER_ANA, USER_BEN]));
        await db.delete(organization).where(inArray(organization.id, [ORG, OTHER_ORG]));
    });

    test("a new shift is a draft in the location's wall clock, with everyone on it, and undo deletes it", async () => {
        const id = newShiftId();
        const { undo } = await apply([
            { op: "create", shiftId: id, shift: draftFields({ capacity: 3 }), assignees: [ben, marco, temp] },
        ]);
        const row = await loadShift(id);
        expect(row).toMatchObject({ status: "draft", title: "Server", capacityTotal: 3, breakMinutes: 30, timezone: TZ });
        expect(row!.startTime.toISOString()).toBe("2027-02-03T21:00:00.000Z"); // 4p EST
        expect(row!.assignments.map((a) => a.pendingState)).toEqual([null, null, null]);
        expect(undo).toEqual([{ op: "delete", shiftId: id }]);

        await apply(undo);
        expect(await loadShift(id)).toBeUndefined();
    });

    test("an overnight end lands on the next day", async () => {
        const id = newShiftId();
        await apply([{ op: "create", shiftId: id, shift: draftFields({ startLocal: "18:00", endLocal: "02:00" }) }]);
        const row = await loadShift(id);
        expect(row!.endTime.toISOString()).toBe("2027-02-04T07:00:00.000Z");
    });

    test("editing a published shift is staged; staff still see the published times", async () => {
        const { undo } = await apply([
            { op: "update", shiftId: PUBLISHED, patch: { startLocal: "17:00", capacity: 3, managerNote: "Cover the patio" } },
        ]);
        const row = await loadShift(PUBLISHED);
        expect(row!.startTime.toISOString()).toBe("2027-02-02T21:00:00.000Z");
        expect(row!.pendingPatch).toEqual({ startTime: "2027-02-02T22:00:00.000Z", capacityTotal: 3 });
        expect(row!.managerNote).toBe("Cover the patio"); // manager-only, not staged

        await apply(undo);
        const restored = await loadShift(PUBLISHED);
        expect(restored!.pendingPatch).toBeNull();
        expect(restored!.managerNote).toBeNull();
    });

    test("people changes on a published shift are staged, and undo puts them back", async () => {
        const { undo } = await apply([{ op: "assign", shiftId: PUBLISHED, assignees: [ben] }]);
        let row = await loadShift(PUBLISHED);
        const state = (id: string) => row!.assignments.find((a) => a.workerId === id)?.pendingState;
        expect(state(ANA)).toBe("remove");
        expect(state(BEN)).toBe("add");

        await apply(undo);
        row = await loadShift(PUBLISHED);
        expect(row!.assignments.map((a) => [a.workerId, a.pendingState])).toEqual([[ANA, null]]);
    });

    test("deleting a published shift stages its removal", async () => {
        const { undo } = await apply([{ op: "delete", shiftId: PUBLISHED }]);
        expect((await loadShift(PUBLISHED))!.pendingPatch).toEqual({ cancel: true });
        await apply(undo);
        expect((await loadShift(PUBLISHED))!.pendingPatch).toBeNull();
    });

    test("deleting a draft removes it, and undo brings back the same shift and people", async () => {
        const id = newShiftId();
        await apply([{ op: "create", shiftId: id, shift: draftFields({ note: "Wear black" }), assignees: [marco] }]);
        const { undo } = await apply([{ op: "delete", shiftId: id }]);
        expect(await loadShift(id)).toBeUndefined();

        await apply(undo);
        const back = await loadShift(id);
        expect(back).toMatchObject({ status: "draft", description: "Wear black", capacityTotal: 2 });
        expect(back!.assignments.map((a) => a.workerId)).toEqual([MARCO]);
    });

    test("double-booking someone needs force, and the override is audited", async () => {
        const id = newShiftId();
        // Tuesday 6p–10p overlaps Ana's published 4p–11p.
        const clash = { op: "create", shiftId: id, shift: draftFields({ localDate: "2027-02-02", startLocal: "18:00", endLocal: "22:00" }), assignees: [ana] };

        const blocked = await apply([clash]).catch((e) => e);
        expect(blocked).toMatchObject({ code: "SCHEDULE_CONFLICT", statusCode: 409 });
        expect(blocked.details.conflicts).toEqual([
            { shiftId: id, personId: ANA, personName: "Ana Ruiz", messages: ["Already on Tue 4p–11p Server"] },
        ]);
        expect(await loadShift(id)).toBeUndefined(); // the whole batch rolled back

        const { overridden } = await apply([clash], true);
        expect(overridden).toHaveLength(1);
        const audit = await db.query.auditLog.findFirst({ where: and(eq(auditLog.organizationId, ORG), eq(auditLog.entityId, id)) });
        expect(audit?.action).toBe("schedule.conflict_override");
    });

    test("approved time off blocks too", async () => {
        const blocked = await apply([
            { op: "create", shiftId: newShiftId(), shift: draftFields({ localDate: "2027-02-05" }), assignees: [ben] },
        ]).catch((e) => e);
        expect(blocked.details.conflicts[0].messages).toEqual(["On approved time off that day"]);
    });

    test("headcount is enforced, but can be raised in the same batch", async () => {
        const full = await apply([{ op: "assign", shiftId: PUBLISHED, assignees: [ana, ben, marco] }]).catch((e) => e);
        expect(full).toMatchObject({ code: "CAPACITY_FULL" });

        await apply([
            { op: "update", shiftId: PUBLISHED, patch: { capacity: 3 } },
            { op: "assign", shiftId: PUBLISHED, assignees: [ana, ben, marco] },
        ]);
        const row = await loadShift(PUBLISHED);
        expect(row!.pendingPatch).toEqual({ capacityTotal: 3 });
        expect(row!.assignments).toHaveLength(3);

        const below = await apply([{ op: "update", shiftId: PUBLISHED, patch: { capacity: 1 } }]).catch((e) => e);
        expect(below).toMatchObject({ code: "CAPACITY_BELOW_ASSIGNED" });
    });

    test("another organization's shift, person or location is out of reach", async () => {
        await expect(apply([{ op: "delete", shiftId: FOREIGN }])).rejects.toMatchObject({ statusCode: 404 });
        await expect(apply([{ op: "assign", shiftId: PUBLISHED, assignees: [{ personId: "wkr_nobody" }] }])).rejects.toMatchObject({
            code: "PERSON_NOT_FOUND",
        });
        await expect(apply([{ op: "create", shiftId: newShiftId(), shift: draftFields({ locationId: "loc_elsewhere" }) }])).rejects.toMatchObject({
            code: "LOCATION_NOT_FOUND",
        });
    });

    test("a shift that has started can't be changed here", async () => {
        await db.update(shift).set({ status: "in-progress" }).where(eq(shift.id, PUBLISHED));
        await expect(apply([{ op: "update", shiftId: PUBLISHED, patch: { role: "Host" } }])).rejects.toMatchObject({ code: "SHIFT_LOCKED" });
    });

    test("an event and its shifts are made together, and deleting the event can be undone", async () => {
        const eventId = `evt_${nanoid(16).replace(/[^0-9A-Za-z]/g, "x")}`;
        const servers = newShiftId();
        const { undo: undoCreate } = await apply([
            { op: "createEvent", eventId, event: { locationId: LOC, localDate: "2027-02-06", startLocal: "15:00", endLocal: "23:00", name: "Smith Wedding" } },
            { op: "create", shiftId: servers, shift: draftFields({ localDate: "2027-02-06", startLocal: "15:00", endLocal: "23:00", capacity: 8, eventId }) },
        ]);
        expect(undoCreate.map((c) => c.op)).toEqual(["delete", "deleteEvent"]);
        const event = await db.query.scheduleEvent.findFirst({ where: eq(scheduleEvent.id, eventId) });
        expect(event).toMatchObject({ name: "Smith Wedding", locationId: LOC, createdBy: USER_ANA });
        expect(event!.startTime.toISOString()).toBe("2027-02-06T20:00:00.000Z");
        expect((await loadShift(servers))!.eventId).toBe(eventId);

        const { undo: undoRename } = await apply([{ op: "updateEvent", eventId, patch: { name: "Smith–Lee Wedding", startLocal: "16:00" } }]);
        expect(undoRename).toEqual([{ op: "updateEvent", eventId, patch: { name: "Smith Wedding", startLocal: "15:00" } }]);

        const { undo: undoDelete } = await apply([{ op: "deleteEvent", eventId }]);
        expect((await loadShift(servers))!.eventId).toBeNull(); // the shift stays, unlinked
        await apply(undoDelete);
        expect((await db.query.scheduleEvent.findFirst({ where: eq(scheduleEvent.id, eventId) }))?.name).toBe("Smith–Lee Wedding");
        expect((await loadShift(servers))!.eventId).toBe(eventId);
    });

    test("discard clears drafts and staging for one week at one location only", async () => {
        const draftThisWeek = newShiftId();
        const draftNextWeek = newShiftId();
        await apply([
            { op: "create", shiftId: draftThisWeek, shift: draftFields() },
            { op: "create", shiftId: draftNextWeek, shift: draftFields({ localDate: "2027-02-10" }) },
            { op: "update", shiftId: PUBLISHED, patch: { role: "Host" } },
            { op: "assign", shiftId: PUBLISHED, assignees: [ana, ben] },
        ]);

        const result = await discardSchedulerWeek({ orgId: ORG, body: { locationId: LOC, weekStart: "2027-02-03" } });
        expect(result).toEqual({ deletedDrafts: 1, revertedShifts: 1, revertedAssignments: 1 });
        expect(await loadShift(draftThisWeek)).toBeUndefined();
        expect(await loadShift(draftNextWeek)).toBeDefined();
        const row = await loadShift(PUBLISHED);
        expect(row!.pendingPatch).toBeNull();
        expect(row!.assignments.map((a) => a.workerId)).toEqual([ANA]);
    });
});
