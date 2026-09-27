import { beforeEach, describe, expect, mock, test } from "bun:test";

// A week at Downtown (New York), Sun 2026-09-27 to Sat 2026-10-03.
const ORG = "org_1";
const DOWNTOWN = "loc_dt";
const RIVERSIDE = "loc_rv";
const NOW = new Date("2026-09-29T15:00:00Z"); // Tue 11:00 in New York

const shiftRow = (over: Record<string, unknown>) => ({
    organizationId: ORG,
    locationId: DOWNTOWN,
    title: "Server",
    description: null,
    timezone: "America/New_York",
    capacityTotal: 1,
    status: "published",
    breakMinutes: 30,
    eventId: null,
    pendingPatch: null,
    managerNote: null,
    assignments: [],
    ...over,
});
const assignment = (over: Record<string, unknown>) => ({
    id: `asg_${Math.random().toString(36).slice(2)}`,
    workerId: null,
    tempWorkerId: null,
    rosterEntryId: null,
    status: "active",
    pendingState: null,
    ...over,
});

let rows: Record<string, unknown[]> = {};

const found = (key: string) => mock(() => Promise.resolve(rows[key] ?? []));
const mockDb = {
    query: {
        organization: { findFirst: mock(() => Promise.resolve(rows.organization?.[0])) },
        location: { findMany: found("location") },
        shift: { findMany: found("shift") },
        member: { findMany: found("member") },
        workerRole: { findMany: found("workerRole") },
        rosterEntry: { findMany: found("rosterEntry") },
        // Read twice: the week's time off, then just the ids of pending requests.
        timeOffRequest: {
            findMany: mock((args: { columns?: unknown }) =>
                Promise.resolve(args?.columns ? rows.pendingTimeOff ?? [] : rows.timeOff ?? []),
            ),
        },
        workerAvailability: { findMany: found("workerAvailability") },
        scheduleEvent: { findMany: found("scheduleEvent") },
        department: { findMany: found("department") },
        shiftRequest: { findMany: found("shiftRequest") },
        user: { findMany: found("user") },
        tempWorker: { findMany: found("tempWorker") },
    },
};

mock.module("@repo/database", () => ({ db: mockDb }));

const { getSchedulerWeek } = await import("../src/modules/scheduler/get-week");

beforeEach(() => {
    rows = {
        organization: [{
            timezone: "America/New_York",
            regionalOvertimePolicy: "weekly_40",
            weekStartsOn: 0,
            scheduleStyle: "steady",
            openShiftClaimPolicy: "approval",
        }],
        location: [
            { id: DOWNTOWN, name: "Downtown Bistro", timezone: "America/New_York" },
            { id: RIVERSIDE, name: "Riverside", timezone: "America/New_York" },
        ],
        member: [
            { jobTitle: null, user: { id: "ana", name: "Ana Ruiz", email: "ana@example.com" } },
            { jobTitle: "server", user: { id: "ben", name: "Ben Kim", email: "ben@example.com" } },
        ],
        workerRole: [{ workerId: "ana", role: "Server" }],
        rosterEntry: [
            { id: "re_marcus", name: "Marcus Lee", email: "marcus@example.com", roles: ["Server"], jobTitle: null },
            // Already a member under the same email: not listed twice.
            { id: "re_ana", name: "Ana Ruiz", email: "ANA@example.com", roles: ["Server"], jobTitle: null },
        ],
        shift: [
            // Mon 4p–11p Downtown: Ana, plus Marcus staged to be added.
            shiftRow({
                id: "s_mon",
                startTime: new Date("2026-09-28T20:00:00Z"),
                endTime: new Date("2026-09-29T03:00:00Z"),
                capacityTotal: 2,
                assignments: [
                    assignment({ workerId: "ana" }),
                    assignment({ rosterEntryId: "re_marcus", pendingState: "add" }),
                ],
            }),
            // Mon 12p–5p at Riverside: Ana again, overlapping the evening shift.
            shiftRow({
                id: "s_rv",
                locationId: RIVERSIDE,
                breakMinutes: 0,
                startTime: new Date("2026-09-28T16:00:00Z"),
                endTime: new Date("2026-09-28T21:00:00Z"),
                assignments: [assignment({ workerId: "ana" })],
            }),
            // Tue 11a–5p draft, nobody on it yet.
            shiftRow({
                id: "s_tue",
                status: "draft",
                startTime: new Date("2026-09-29T15:00:00Z"),
                endTime: new Date("2026-09-29T21:00:00Z"),
            }),
            // Thu 3p–11p, published, with a staged move to 4p.
            shiftRow({
                id: "s_thu",
                startTime: new Date("2026-10-01T19:00:00Z"),
                endTime: new Date("2026-10-02T03:00:00Z"),
                pendingPatch: { startTime: "2026-10-01T20:00:00.000Z" },
                assignments: [assignment({ workerId: "ben" })],
            }),
            // Sat 6p–2a overnight.
            shiftRow({
                id: "s_sat",
                title: "Bartender",
                startTime: new Date("2026-10-03T22:00:00Z"),
                endTime: new Date("2026-10-04T06:00:00Z"),
                assignments: [assignment({ workerId: "ben" })],
            }),
            // Last Saturday: only there for overlap checks, not drawn.
            shiftRow({
                id: "s_last_week",
                startTime: new Date("2026-09-26T20:00:00Z"),
                endTime: new Date("2026-09-27T03:00:00Z"),
                assignments: [assignment({ workerId: "ben" })],
            }),
        ],
        timeOff: [{
            id: "tor_1",
            workerId: "ben",
            status: "approved",
            allDay: true,
            reason: "Moving house",
            startTime: new Date("2026-09-29T04:00:00Z"),
            endTime: new Date("2026-09-30T04:00:00Z"),
        }],
        pendingTimeOff: [{ id: "tor_2" }],
        shiftRequest: [{ id: "req_1" }],
    };
});

describe("getSchedulerWeek", () => {
    test("builds the week around the location's calendar", async () => {
        const week = await getSchedulerWeek({ orgId: ORG, locationId: DOWNTOWN, now: NOW });

        expect(week.weekStart).toBe("2026-09-27");
        expect(week.location).toEqual({ id: DOWNTOWN, name: "Downtown Bistro", timezone: "America/New_York" });
        expect(week.days.map((d) => d.localDate)).toEqual([
            "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03",
        ]);
        expect(week.days.filter((d) => d.isToday).map((d) => d.index)).toEqual([2]);
        expect(week.settings).toEqual({ overtimePolicy: "weekly_40", scheduleStyle: "steady", openShiftClaimPolicy: "approval" });
    });

    test("any date in the week lands on the same week", async () => {
        const week = await getSchedulerWeek({ orgId: ORG, locationId: DOWNTOWN, weekStart: "2026-10-01", now: NOW });
        expect(week.weekStart).toBe("2026-09-27");
    });

    test("returns only this location's shifts in this week, in wall-clock time", async () => {
        const week = await getSchedulerWeek({ orgId: ORG, locationId: DOWNTOWN, now: NOW });
        expect(week.shifts.map((s) => s.id)).toEqual(["s_mon", "s_tue", "s_thu", "s_sat"]);

        const sat = week.shifts.find((s) => s.id === "s_sat")!;
        expect(sat).toMatchObject({ dayIndex: 6, startLocal: "18:00", endLocal: "02:00", overnight: true, role: "Bartender" });
    });

    test("shows staged edits as the manager's working copy", async () => {
        const week = await getSchedulerWeek({ orgId: ORG, locationId: DOWNTOWN, now: NOW });
        const thu = week.shifts.find((s) => s.id === "s_thu")!;
        expect(thu).toMatchObject({ startLocal: "16:00", endLocal: "23:00", hasUnpublishedEdits: true, status: "published" });

        const mon = week.shifts.find((s) => s.id === "s_mon")!;
        expect(mon.hasUnpublishedEdits).toBe(true); // Marcus is staged
        expect(mon.assignees.map((a) => [a.personId, a.kind, a.pendingState])).toEqual([
            ["ana", "roster", null],
            ["re_marcus", "invited", "add"],
        ]);
        expect(mon).toMatchObject({ capacity: 2, filled: 2, open: 0 });

        // A draft is a pending change but not an "edit to a published shift".
        const tue = week.shifts.find((s) => s.id === "s_tue")!;
        expect(tue).toMatchObject({ status: "draft", hasUnpublishedEdits: false, open: 1 });
        expect(week.summary).toEqual({ openSlots: 1, pendingChangeCount: 3, pendingRequestCount: 2 });
    });

    test("flags a double-booking at another location as blocking", async () => {
        const week = await getSchedulerWeek({ orgId: ORG, locationId: DOWNTOWN, now: NOW });
        const ana = week.shifts.find((s) => s.id === "s_mon")!.assignees.find((a) => a.personId === "ana")!;
        expect(ana.warnings).toContainEqual({
            type: "overlap",
            severity: "block",
            message: "Already on Mon 12p–5p Server at Riverside",
        });
    });

    test("counts hours across every location, after breaks", async () => {
        const week = await getSchedulerWeek({ orgId: ORG, locationId: DOWNTOWN, now: NOW });
        const byId = new Map(week.people.map((p) => [p.id, p]));
        // Ana: Mon evening 6.5h + Riverside 5h. Last week's shift does not count.
        expect(byId.get("ana")!.scheduledMinutes).toBe(690);
        // Ben: Thu 4p–11p after the staged move (6.5h) + Sat overnight (7.5h).
        expect(byId.get("ben")!.scheduledMinutes).toBe(840);
        expect(byId.get("re_marcus")).toMatchObject({ kind: "invited", scheduledMinutes: 390 });
        // Marcus's roster entry is listed once; Ana's duplicate entry is dropped.
        expect(week.people.map((p) => p.id).sort()).toEqual(["ana", "ben", "re_marcus"]);
        expect(byId.get("ben")!.roles).toEqual(["Server"]);
    });

    test("lays time off onto the days it covers", async () => {
        const week = await getSchedulerWeek({ orgId: ORG, locationId: DOWNTOWN, now: NOW });
        expect(week.timeOff).toEqual([{
            id: "tor_1",
            personId: "ben",
            status: "approved",
            allDay: true,
            reason: "Moving house",
            startsAt: "2026-09-29T04:00:00.000Z",
            endsAt: "2026-09-30T04:00:00.000Z",
            spans: [{ dayIndex: 2, startLocal: "00:00", endLocal: "24:00", wholeDay: true }],
        }]);
    });

    test("falls back to one Team department until departments are set up", async () => {
        const week = await getSchedulerWeek({ orgId: ORG, locationId: DOWNTOWN, now: NOW });
        expect(week.departments).toEqual([{ id: "team", name: "Team", roles: ["Server"] }]);
        expect(week.people.every((p) => p.departmentId === "team")).toBe(true);
    });

    test("uses real departments when the organization has them", async () => {
        rows.department = [
            { id: "dep_boh", name: "Kitchen", roles: ["Line cook"], sortOrder: 1 },
            { id: "dep_foh", name: "Front of house", roles: ["server", "bartender"], sortOrder: 0 },
        ];
        const week = await getSchedulerWeek({ orgId: ORG, locationId: DOWNTOWN, now: NOW });
        expect(week.departments.map((d) => d.name)).toEqual(["Front of house", "Kitchen"]);
        expect(week.departments[0]!.roles).toEqual(["Server", "Bartender"]);
        expect(week.people.find((p) => p.id === "ana")!.departmentId).toBe("dep_foh");
    });

    test("places people by any role they hold, then in the department with no roles", async () => {
        rows.department = [
            { id: "dep_bar", name: "Bar", roles: ["Bartender"], sortOrder: 0 },
            { id: "dep_team", name: "Team", roles: [], sortOrder: 1 },
        ];
        rows.workerRole = [
            { workerId: "ana", role: "Server" },
            { workerId: "ana", role: "Bartender" },
        ];
        const week = await getSchedulerWeek({ orgId: ORG, locationId: DOWNTOWN, now: NOW });
        const dept = (id: string) => week.people.find((p) => p.id === id)!.departmentId;
        expect(dept("ana")).toBe("dep_bar"); // Server matches nothing, Bartender does
        expect(dept("ben")).toBe("dep_team"); // nothing matches: the catch-all
    });

    test("rejects a malformed week and a location outside the organization", async () => {
        await expect(getSchedulerWeek({ orgId: ORG, locationId: DOWNTOWN, weekStart: "2026-13-01", now: NOW }))
            .rejects.toMatchObject({ code: "INVALID_WEEK_START", statusCode: 400 });
        await expect(getSchedulerWeek({ orgId: ORG, locationId: "loc_elsewhere", now: NOW }))
            .rejects.toMatchObject({ code: "LOCATION_NOT_FOUND", statusCode: 404 });
    });
});
