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
    workerId: "wkr_ana",
    status: "active",
    pendingState: null,
    ...over,
});
// A worker on the business's list. `userId` is the app account, once they have one.
const person = (over: Record<string, unknown>) => ({
    userId: null,
    employmentType: "staff",
    agency: null,
    status: "active",
    roles: [],
    jobTitle: null,
    ...over,
});

let rows: Record<string, unknown[]> = {};

const found = (key: string) => mock(() => Promise.resolve(rows[key] ?? []));
const mockDb = {
    query: {
        organization: { findFirst: mock(() => Promise.resolve(rows.organization?.[0])) },
        location: { findMany: found("location") },
        shift: { findMany: found("shift") },
        worker: { findMany: found("worker") },
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
        worker: [
            person({ id: "wkr_ana", name: "Ana Ruiz", userId: "ana", roles: ["Server"] }),
            person({ id: "wkr_ben", name: "Ben Kim", userId: "ben", jobTitle: "server" }),
            // Invited to the app but has not signed in: schedulable all the same.
            person({ id: "wkr_marcus", name: "Marcus Lee", status: "invited", roles: ["Server"] }),
        ],
        shift: [
            // Mon 4p–11p Downtown: Ana, plus Marcus staged to be added.
            shiftRow({
                id: "s_mon",
                startTime: new Date("2026-09-28T20:00:00Z"),
                endTime: new Date("2026-09-29T03:00:00Z"),
                capacityTotal: 2,
                assignments: [
                    assignment({ workerId: "wkr_ana" }),
                    assignment({ workerId: "wkr_marcus", pendingState: "add" }),
                ],
            }),
            // Mon 12p–5p at Riverside: Ana again, overlapping the evening shift.
            shiftRow({
                id: "s_rv",
                locationId: RIVERSIDE,
                breakMinutes: 0,
                startTime: new Date("2026-09-28T16:00:00Z"),
                endTime: new Date("2026-09-28T21:00:00Z"),
                assignments: [assignment({ workerId: "wkr_ana" })],
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
                assignments: [assignment({ workerId: "wkr_ben" })],
            }),
            // Sat 6p–2a overnight.
            shiftRow({
                id: "s_sat",
                title: "Bartender",
                startTime: new Date("2026-10-03T22:00:00Z"),
                endTime: new Date("2026-10-04T06:00:00Z"),
                assignments: [assignment({ workerId: "wkr_ben" })],
            }),
            // Last Saturday: only there for overlap checks, not drawn.
            shiftRow({
                id: "s_last_week",
                startTime: new Date("2026-09-26T20:00:00Z"),
                endTime: new Date("2026-09-27T03:00:00Z"),
                assignments: [assignment({ workerId: "wkr_ben" })],
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
            ["wkr_ana", "active", null],
            ["wkr_marcus", "invited", "add"],
        ]);
        expect(mon).toMatchObject({ capacity: 2, filled: 2, open: 0 });

        // A draft is a pending change but not an "edit to a published shift".
        const tue = week.shifts.find((s) => s.id === "s_tue")!;
        expect(tue).toMatchObject({ status: "draft", hasUnpublishedEdits: false, open: 1 });
        expect(week.summary).toEqual({ openSlots: 1, pendingChangeCount: 3, pendingRequestCount: 2 });
    });

    test("flags a double-booking at another location as blocking", async () => {
        const week = await getSchedulerWeek({ orgId: ORG, locationId: DOWNTOWN, now: NOW });
        const ana = week.shifts.find((s) => s.id === "s_mon")!.assignees.find((a) => a.personId === "wkr_ana")!;
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
        expect(byId.get("wkr_ana")!.scheduledMinutes).toBe(690);
        // Ben: Thu 4p–11p after the staged move (6.5h) + Sat overnight (7.5h).
        expect(byId.get("wkr_ben")!.scheduledMinutes).toBe(840);
        expect(byId.get("wkr_marcus")).toMatchObject({ kind: "invited", scheduledMinutes: 390 });
        expect(byId.get("wkr_ana")).toMatchObject({ kind: "active" });
        expect(week.people.map((p) => p.id).sort()).toEqual(["wkr_ana", "wkr_ben", "wkr_marcus"]);
        expect(byId.get("wkr_ben")!.roles).toEqual(["Server"]);
    });

    test("lays time off onto the days it covers", async () => {
        const week = await getSchedulerWeek({ orgId: ORG, locationId: DOWNTOWN, now: NOW });
        expect(week.timeOff).toEqual([{
            id: "tor_1",
            personId: "wkr_ben",
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
        expect(week.people.find((p) => p.id === "wkr_ana")!.departmentId).toBe("dep_foh");
    });

    test("places people by any role they hold, then in the department with no roles", async () => {
        rows.department = [
            { id: "dep_bar", name: "Bar", roles: ["Bartender"], sortOrder: 0 },
            { id: "dep_team", name: "Team", roles: [], sortOrder: 1 },
        ];
        rows.worker = [
            person({ id: "wkr_ana", name: "Ana Ruiz", userId: "ana", roles: ["Server", "Bartender"] }),
            person({ id: "wkr_ben", name: "Ben Kim", userId: "ben", jobTitle: "server" }),
            person({ id: "wkr_marcus", name: "Marcus Lee", status: "invited", roles: ["Server"] }),
        ];
        const week = await getSchedulerWeek({ orgId: ORG, locationId: DOWNTOWN, now: NOW });
        const dept = (id: string) => week.people.find((p) => p.id === id)!.departmentId;
        expect(dept("wkr_ana")).toBe("dep_bar"); // Server matches nothing, Bartender does
        expect(dept("wkr_ben")).toBe("dep_team"); // nothing matches: the catch-all
    });

    test("agency temps and paused workers only appear while they are on a shift this week", async () => {
        rows.worker = [
            ...(rows.worker as Record<string, unknown>[]),
            person({ id: "wkr_temp_idle", name: "Temp 1", employmentType: "agency", agency: "ABC Staffing" }),
            person({ id: "wkr_temp_busy", name: "Temp 2", employmentType: "agency", agency: "ABC Staffing" }),
            person({ id: "wkr_paused", name: "Pat Paused", userId: "pat", status: "inactive" }),
            person({ id: "wkr_left", name: "Lee Left", userId: "lee", status: "inactive" }),
        ];
        rows.shift = [
            shiftRow({
                id: "s_wed",
                startTime: new Date("2026-09-30T20:00:00Z"),
                endTime: new Date("2026-10-01T03:00:00Z"),
                capacityTotal: 2,
                assignments: [assignment({ workerId: "wkr_temp_busy" }), assignment({ workerId: "wkr_left" })],
            }),
        ];

        const week = await getSchedulerWeek({ orgId: ORG, locationId: DOWNTOWN, now: NOW });
        const byId = new Map(week.people.map((p) => [p.id, p]));

        expect(byId.has("wkr_temp_idle")).toBe(false);
        expect(byId.has("wkr_paused")).toBe(false);
        expect(byId.get("wkr_temp_busy")).toMatchObject({ kind: "agency", agencyName: "ABC Staffing" });
        // Someone paused after being scheduled is still drawn, so their shift is not orphaned.
        expect(byId.has("wkr_left")).toBe(true);
    });

    test("rejects a malformed week and a location outside the organization", async () => {
        await expect(getSchedulerWeek({ orgId: ORG, locationId: DOWNTOWN, weekStart: "2026-13-01", now: NOW }))
            .rejects.toMatchObject({ code: "INVALID_WEEK_START", statusCode: 400 });
        await expect(getSchedulerWeek({ orgId: ORG, locationId: "loc_elsewhere", now: NOW }))
            .rejects.toMatchObject({ code: "LOCATION_NOT_FOUND", statusCode: 404 });
    });
});
