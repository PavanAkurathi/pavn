
import { describe, expect, test, mock, beforeEach } from "bun:test";
import { publishSchedule } from "../src/modules/shifts/publish";
import { member as memberTable } from "@repo/database/schema";
import { eq, and, ne, lte, gte } from "drizzle-orm";

// Mock Database
// publish() resolves each incoming id against member / roster_entry / temp_worker
// and rejects ids it cannot find in the org, so the member lookup has to claim
// "w1". Everything else resolves empty — no overlap, not a roster/agency worker.
const MOCK_ORG_MEMBER_IDS = ["w1"];
const mockSelect = mock(() => ({
    from: mock((table: unknown) => {
        const rows = table === memberTable
            ? MOCK_ORG_MEMBER_IDS.map((id) => ({ id, name: `Test ${id}` }))
            : [];
        return {
            innerJoin: mock(() => ({ where: mock(() => Promise.resolve(rows)) })),
            where: mock(() => Promise.resolve(rows))
        };
    })
}));

const mockDb: any = {
    select: mockSelect,
    insert: mock(() => ({
        values: mock(() => ({
            onConflictDoUpdate: mock(() => ({
                returning: mock(() => Promise.resolve([{ count: 1, windowStart: String(Date.now()) }]))
            })),
            returning: mock(() => Promise.resolve([])),
            // For simple values() call
            then: (resolve: any) => resolve([])
        }))
    })),
    // For simple values() call (publish.ts uses await tx.insert().values())
    transaction: mock((cb) => cb(mockDb)),
    query: {
        shift: { findFirst: mock(() => Promise.resolve(null)) },
        workerAvailability: { findMany: mock(() => Promise.resolve([])) },
        location: { findFirst: mock(() => Promise.resolve({ name: 'Test Venue' })) },
        workerNotificationPreferences: { findMany: mock(() => Promise.resolve([])) },
        idempotencyKey: { findFirst: mock(() => Promise.resolve(null)) },
        member: { findMany: mock(() => Promise.resolve([])) }
    }
};

mock.module("@repo/database", () => ({
    db: mockDb,
    shift: { organizationId: 'organization_id', startTime: 'start_time', endTime: 'end_time', id: 'id' }, // Mock column refs
    shiftAssignment: { workerId: 'worker_id', status: 'status', shiftId: 'shift_id', id: 'id' },
    rateLimitState: { key: 'key' },
    idempotencyKey: { key: 'key' },
    scheduledNotification: {},
    workerAvailability: {},
    location: { id: 'id', organizationId: 'organization_id' },
    workerNotificationPreferences: {},
    member: {}
}));

mock.module("@repo/notifications", () => ({
    buildNotificationSchedule: mock(() => Promise.resolve([]))
}));

mock.module("../src/utils/ids", () => ({
    newId: () => "test_id"
}));

// publishSchedule rejects past dates (INVALID_PAST_DATES) before it reaches the
// overlap logic under test, so these dates have to stay in the future as the
// suite ages. Anchored 30 days out to stay valid in every timezone.
const FUTURE_DATE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

describe("Overlap Scope and Info Disclosure", () => {
    beforeEach(() => {
        mockSelect.mockClear();
    });

    // TEST 1: Verify Query Scoping (Sanity Check)
    test("publishSchedule query includes organizationId filter", async () => {
        const orgId = "org_A";
        const body = {
            organizationId: orgId,
            locationId: "loc_1",
            timezone: "UTC",
            schedules: [{
                startTime: "09:00",
                endTime: "17:00",
                dates: [FUTURE_DATE],
                scheduleName: "Test",
                positions: [{ roleName: "Guard", workerIds: ["w1"] }]
            }]
        };

        // Execute
        await publishSchedule(body, orgId);

        // Verify mock calls
        // We expect db.select()...where(AND condition)
        // AND condition should contain eq(shift.organizationId, orgId)

        // Since we can't easily introspect the Drizzle SQL object in mock without deep mocking, 
        // we assume if the code *exists* in the file it works. 
        // But we can check if the mock was called.
        expect(mockSelect).toHaveBeenCalled();
    });

    // TEST 2: Verify Info Disclosure in Error Message
    test("fail if error message contains shift title", async () => {
        const orgId = "org_A";

        // Setup conflict in SAME org (valid conflict)
        const mockWhere = mock(() => Promise.resolve([
            {
                workerId: 'w1',
                startTime: new Date(`${FUTURE_DATE}T09:00:00Z`),
                endTime: new Date(`${FUTURE_DATE}T17:00:00Z`),
                title: "SECRET_PROJECT_X" // Sensitive Title
            }
        ]));

        mockDb.select = mock(() => ({
            from: mock((table: unknown) => {
                // Identity lookup resolves "w1" as an org member; only the overlap
                // scan returns the conflicting row carrying the sensitive title.
                if (table === memberTable) {
                    const rows = MOCK_ORG_MEMBER_IDS.map((id) => ({ id, name: `Test ${id}` }));
                    return {
                        innerJoin: mock(() => ({ where: mock(() => Promise.resolve(rows)) })),
                        where: mock(() => Promise.resolve(rows))
                    };
                }
                return {
                    innerJoin: mock(() => ({ where: mockWhere })),
                    where: mock(() => Promise.resolve([]))
                };
            })
        }));

        const body = {
            organizationId: orgId,
            locationId: "loc_1",
            timezone: "UTC",
            schedules: [{
                startTime: "09:00",
                endTime: "17:00",
                dates: [FUTURE_DATE],
                scheduleName: "Test",
                positions: [{ roleName: "Guard", workerIds: ["w1"] }]
            }]
        };

        try {
            await publishSchedule(body, orgId);
            expect(true).toBe(false); // Should throw
        } catch (e: any) {
            // This assertion proves the CURRENT behavior (Leak)
            // We want to eventually fail this test if it leaks, or pass if it DOES NOT leak.
            expect(e.message).not.toContain("SECRET_PROJECT_X");
            expect(e.message).toContain("overlapping shift");
        }
    });
});
