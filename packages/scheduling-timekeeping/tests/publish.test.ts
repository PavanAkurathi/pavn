
import { describe, expect, test, mock, beforeEach } from "bun:test";
import { publishSchedule } from "../src/modules/shifts/publish";
import { member as memberTable } from "@repo/database/schema";
import { nanoid } from "nanoid";

// Worker ids these tests assign, all of them app users in org_123.
const MOCK_ORG_MEMBER_IDS = ["w1", "worker_1", "worker_2", "worker_3", "worker_rate_test"];

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

function futureDate(daysFromNow: number) {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() + daysFromNow);
    return isoDate(date);
}

function nextWeekdayDate(weekday: number) {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    const daysUntilWeekday = (weekday - date.getUTCDay() + 7) % 7 || 7;
    date.setUTCDate(date.getUTCDate() + daysUntilWeekday);
    return isoDate(date);
}

function addDays(dateString: string, days: number) {
    const date = new Date(`${dateString}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return isoDate(date);
}

// --- Mocks ---
// We need to capture what is inserted to verify the structure
// For fluent API: db.insert().values().onConflictDoUpdate().returning()
const mockReturning = mock(() => Promise.resolve([{ count: 1, windowStart: String(Date.now()) }]));
const mockOnConflict = mock(() => ({ returning: mockReturning }));

// This mock needs to handle both:
// 1. .values(...).onConflictDoUpdate(...).returning() [Rate Limit]
// 2. .values(...) [Regular Insert - actually in Drizzle values() returns a promise-like object if awaited, or builder if chained]
// In publish.ts:
// await tx.insert(shift).values(...) -> returns Promise
// await db.insert(rateLimitState).values(...).onConflictDoUpdate(...).returning() -> returns Promise

const mockValuesChain = {
    onConflictDoUpdate: mockOnConflict,
    then: (resolve: any) => resolve([]), // Make it thenable for await
};

const mockInsertValues = mock(() => mockValuesChain);

// Create a mock builder that returns itself for chainable methods
const mockBuilder: any = {
    insert: mock(() => ({
        values: mockInsertValues
    })),
    transaction: mock((cb) => cb(mockBuilder)), // Exec callback immediately
    query: {
        shift: { findFirst: mock(() => Promise.resolve(null)) },
        workerAvailability: { findMany: mock(() => Promise.resolve([])) },
        // A location always carries a timezone now: it is derived from its
        // coordinates at creation, and publish anchors shift times to it.
        location: { findFirst: mock(() => Promise.resolve({ name: 'Test Venue', timezone: 'America/New_York' })) },
        workerNotificationPreferences: { findMany: mock(() => Promise.resolve([])) },
        idempotencyKey: { findFirst: mock(() => Promise.resolve(null)) },
        member: { findMany: mock(() => Promise.resolve([])) }
    },
    select: mock(() => ({
        from: mock((table: unknown) => {
            // publish() resolves every incoming id against member / roster_entry /
            // temp_worker to decide which identity column it belongs in, and
            // rejects anything it cannot find in this org. These tests all assign
            // app users, so the member lookup has to claim their ids — otherwise
            // they read as belonging to another tenant. Any other table (the
            // overlap scan, roster, temp) resolves empty, which is the "no
            // conflicts, not a roster/agency worker" case these tests want.
            const isMemberLookup = table === memberTable;
            const rows = isMemberLookup
                ? MOCK_ORG_MEMBER_IDS.map((id) => ({ id, name: `Test ${id}` }))
                : [];
            return {
                innerJoin: mock(() => ({ where: mock(() => Promise.resolve(rows)) })),
                where: mock(() => Promise.resolve(rows))
            };
        })
    }))
};

mock.module("@repo/database", () => ({
    db: mockBuilder,
    shift: { $inferInsert: {} },
    shiftAssignment: { $inferInsert: {} },
    rateLimitState: {},
    idempotencyKey: {},
    scheduledNotification: {},
    workerAvailability: {},
    location: { id: 'id', organizationId: 'organization_id' },
    workerNotificationPreferences: {},
    member: {}
}));

mock.module("../src/modules/time-tracking/overlap", () => ({
    findOverlappingAssignment: mock(() => Promise.resolve(null))
}));

mock.module("@repo/notifications", () => ({
    buildNotificationSchedule: mock(() => Promise.resolve([]))
}));


describe("Publish  (WH-131 Fix)", () => {

    beforeEach(() => {
        mockInsertValues.mockClear();
    });

    test("creates ONE shift with MULTIPLE assignments for a multi-worker block", async () => {
        const orgId = "org_123";
        const locationId = "loc_123";

        const req = new Request("http://localhost/api/shifts/publish", {
            method: "POST",
            body: JSON.stringify({
                organizationId: orgId,
                locationId: locationId,
                timezone: "UTC",
                schedules: [{
                    startTime: "09:00",
                    endTime: "17:00",
                    dates: [futureDate(14)],
                    scheduleName: "Morning Shift",
                    positions: [{
                        roleName: "Server",
                        workerIds: ["worker_1", "worker_2", "worker_3"] // 3 Workers
                    }]
                }]
            })
        });

        const res = await publishSchedule(await req.json(), orgId); // Pass parsed body

        // Analyze calls to db.insert(table).values(...)
        // We expect inserts for rate limit, shifts, assignments, notifications, idempotency key (if enabled)

        const calls = mockInsertValues.mock.calls as any[];
        // Filter out rate limit insert (count check)
        // Rate limit insert values: { key: ..., count: ... }
        // Shift insert values: [ { id: ... } ]

        const shiftAndAssignmentCalls = calls.filter(args => Array.isArray(args[0]));

        const allInserts: any[] = [];
        for (const call of shiftAndAssignmentCalls) {
            allInserts.push(...call[0]);
        }

        const shifts = allInserts.filter((i: any) => i.capacityTotal !== undefined); // Shifts have capacityTotal
        const assignments = allInserts.filter((i: any) => i.workerId !== undefined && i.status === 'active'); // Assignments

        // EXPECTATION FOR WH-131:
        // 1 Shift created
        expect(shifts.length).toBe(1);
        expect(shifts[0].capacityTotal).toBe(3); // 3 worker slots

        // 3 Assignments created
        expect(assignments.length).toBe(3);

        // Verify linking
        const shiftId = shifts[0].id;
        expect(assignments[0].shiftId).toBe(shiftId);
        expect(assignments[1].shiftId).toBe(shiftId);
        expect(assignments[2].shiftId).toBe(shiftId);
    });

    test("handles OPEN slots (null workers) correctly", async () => {
        const orgId = "org_123";

        const req = new Request("http://localhost/api/shifts/publish", {
            method: "POST",
            body: JSON.stringify({
                organizationId: orgId,
                locationId: "loc_1",
                timezone: "UTC",
                schedules: [{
                    startTime: "09:00",
                    endTime: "17:00",
                    dates: [futureDate(15)],
                    scheduleName: "Open Shift Test",
                    positions: [{
                        roleName: "Server",
                        // 1 Assigned, 2 Open
                        workerIds: ["worker_1", null, null]
                    }]
                }]
            })
        });

        await publishSchedule(await req.json(), orgId);

        const calls = mockInsertValues.mock.calls as any[];
        const shiftAndAssignmentCalls = calls.filter(args => Array.isArray(args[0]));

        const allInserts: any[] = [];
        for (const call of shiftAndAssignmentCalls) {
            allInserts.push(...call[0]);
        }

        const shifts = allInserts.filter((i: any) => i.capacityTotal !== undefined);
        const assignments = allInserts.filter((i: any) => i.workerId !== undefined && i.status === 'active');

        expect(shifts.length).toBe(1);
        expect(shifts[0].capacityTotal).toBe(3); // 1 worker + 2 open = 3 capacity

        expect(assignments.length).toBe(1); // Only 1 actual assignment for worker_1
        expect(assignments[0].workerId).toBe("worker_1");
    });

    test("rejects empty dates array", async () => {
        const orgId = "org_123";
        const body = {
            organizationId: orgId,
            locationId: "loc_1",
            timezone: "UTC",
            schedules: [{
                startTime: "09:00",
                endTime: "17:00",
                dates: [], // Empty
                scheduleName: "Test",
                positions: []
            }]
        };

        try {
            await publishSchedule(body, orgId);
            expect(true).toBe(false); // Should not reach here
        } catch (e: any) {
            expect(e.statusCode).toBe(400);
            expect(e.message).toContain("Validation Failed");
        }
    });

    test("rejects past dates", async () => {
        const orgId = "org_123";
        const body = {
            organizationId: orgId,
            locationId: "loc_1",
            timezone: "UTC",
            schedules: [{
                startTime: "09:00",
                endTime: "17:00",
                dates: ["1999-01-01"], // Definitely past
                scheduleName: "Past Test",
                positions: []
            }]
        };

        try {
            await publishSchedule(body, orgId);
            expect(true).toBe(false);
        } catch (e: any) {
            expect(e.statusCode).toBe(400);
            expect(e.code).toBe("INVALID_PAST_DATES");
            expect(e.message).toContain("1999-01-01");
        }
    });

    test("rejects a location that is outside the active organization", async () => {
        const orgId = "org_123";
        const body = {
            organizationId: orgId,
            locationId: "foreign_loc",
            timezone: "UTC",
            schedules: [{
                startTime: "09:00",
                endTime: "17:00",
                dates: [futureDate(16)],
                scheduleName: "Foreign Venue",
                positions: []
            }]
        };

        mockBuilder.query.location.findFirst.mockResolvedValueOnce(null);

        await expect(publishSchedule(body, orgId)).rejects.toMatchObject({
            statusCode: 404,
            code: "NOT_FOUND",
        });
    });

    // WH-130: Recurrence Tests
    test("expands recurring dates (weekly)", async () => {
        const orgId = "org_123";
        const startMonday = nextWeekdayDate(1);
        const body = {
            organizationId: orgId,
            locationId: "loc_1",
            timezone: "UTC",
            recurrence: {
                enabled: true,
                pattern: 'weekly',
                daysOfWeek: [1, 3], // Mon, Wed
                endType: 'after_weeks',
                endAfter: 2 // 2 weeks
            },
            schedules: [{
                startTime: "09:00",
                endTime: "17:00",
                dates: [startMonday],
                scheduleName: "Recurring Test",
                positions: [{
                    roleName: "Server",
                    workerIds: ["w1"]
                }]
            }]
        };

        const res = await publishSchedule(body, orgId);
        // Expect 2 weeks * 2 days = 4 shifts
        expect(res.count).toBe(4);
    });

    test("expands recurring dates (on_date)", async () => {
        const orgId = "org_123";
        const startFriday = nextWeekdayDate(5);
        const endDate = addDays(startFriday, 10);
        const body = {
            organizationId: orgId,
            locationId: "loc_1",
            timezone: "UTC",
            recurrence: {
                enabled: true,
                pattern: 'weekly',
                daysOfWeek: [5], // Friday
                endType: 'on_date',
                endDate
            },
            schedules: [{
                startTime: "09:00",
                endTime: "17:00",
                dates: [startFriday],
                scheduleName: "Recurring Test",
                positions: [{ roleName: "Cook", workerIds: ["w1"] }]
            }]
        };

        const res = await publishSchedule(body, orgId);
        expect(res.count).toBe(2); // June 5, June 12
    });
    test("anchors shift times to the location's timezone, not the client's", async () => {
        // The scenario this rule exists for: a manager sitting in California
        // schedules 09:00 at a Boston site. The crew must be booked for 9am
        // Boston (13:00Z), not 9am Pacific (16:00Z).
        const orgId = "org_123";
        mockInsertValues.mockClear();

        const body = {
            locationId: "loc_boston",
            organizationId: orgId,
            timezone: "America/Los_Angeles", // the manager's browser
            schedules: [{
                startTime: "09:00",
                endTime: "17:00",
                dates: ["2026-08-20"],
                scheduleName: "Timezone Test",
                positions: [{ roleName: "Loader", workerIds: [null] }]
            }]
        };

        await publishSchedule(body, orgId);

        type InsertedShift = { capacityTotal?: number; startTime: Date; timezone?: string };
        const inserted = (mockInsertValues.mock.calls as unknown[][])
            .filter((args) => Array.isArray(args[0]))
            .flatMap((call) => call[0] as InsertedShift[])
            .filter((row) => row.capacityTotal !== undefined);

        expect(inserted.length).toBe(1);
        const shiftRow = inserted[0]!;
        // 09:00 America/New_York on 2026-08-20 (EDT, UTC-4) is 13:00Z.
        expect(shiftRow.startTime.toISOString()).toBe("2026-08-20T13:00:00.000Z");
        // and the zone is recorded on the shift so a later location edit
        // cannot move it.
        expect(shiftRow.timezone).toBe("America/New_York");
    });

    test("captures silent hourly rate snapshot (WOR-26)", async () => {
        const orgId = "org_123";
        const workerId = "worker_rate_test";
        const hourlyRate = 2500; // $25.00

        // Mock member lookup to return rate
        mockBuilder.query.member.findMany = mock(() => Promise.resolve([
            { userId: workerId, hourlyRate: hourlyRate }
        ]));

        const body = {
            organizationId: orgId,
            locationId: "loc_1",
            timezone: "UTC",
            schedules: [{
                startTime: "09:00",
                endTime: "17:00",
                dates: [futureDate(17)],
                scheduleName: "Rate Test",
                positions: [{
                    roleName: "Server",
                    workerIds: [workerId]
                }]
            }]
        };

        await publishSchedule(body, orgId);

        const calls = mockInsertValues.mock.calls as any[];
        const shiftAndAssignmentCalls = calls.filter(args => Array.isArray(args[0]));

        const allInserts: any[] = [];
        for (const call of shiftAndAssignmentCalls) {
            allInserts.push(...call[0]);
        }

        const assignment = allInserts.find((i: any) => i.workerId === workerId && i.status === 'active');

        expect(assignment).toBeDefined();
        // TICKET-006: budgetRateSnapshot is now NULL
        expect(assignment.budgetRateSnapshot).toBeNull();
    });
});
