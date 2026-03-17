import { beforeEach, describe, expect, mock, test } from "bun:test";

const memberTable = {
    __table: "member",
    organizationId: "organization_id",
    userId: "user_id",
    status: "status",
    role: "role",
};

const shiftAssignmentTable = {
    __table: "shift_assignment",
    workerId: "worker_id",
    status: "assignment_status",
    shiftId: "shift_id",
    id: "id",
    actualClockIn: "actual_clock_in",
    actualClockOut: "actual_clock_out",
};

const shiftTable = {
    __table: "shift",
    organizationId: "organization_id",
    endTime: "end_time",
    startTime: "start_time",
    status: "shift_status",
    id: "shift_id",
    locationId: "location_id",
};

const locationTable = {
    __table: "location",
    id: "location_id",
    name: "location_name",
    address: "location_address",
    geofenceRadius: "geofence_radius",
    position: "position",
};

const organizationTable = {
    __table: "organization",
    id: "organization_id",
    name: "organization_name",
};

const mockMembershipRows = mock(() => Promise.resolve([
    { orgId: "org_a", role: "member" },
    { orgId: "org_b", role: "member" },
]));

const mockShiftRows = mock(() => Promise.resolve<any[]>([]));
const mockMissingOrgRows = mock(() => Promise.resolve<any[]>([]));

const mockDb = {
    select: mock(() => ({
        from: mock((table: any) => {
            if (table === memberTable) {
                return {
                    where: mockMembershipRows,
                };
            }

            if (table === shiftAssignmentTable) {
                return {
                    innerJoin: mock(() => ({
                        leftJoin: mock(() => ({
                            innerJoin: mock(() => ({
                                where: mock(() => ({
                                    orderBy: mock(() => ({
                                        limit: mock(() => ({
                                            offset: mockShiftRows,
                                        })),
                                    })),
                                })),
                            })),
                        })),
                    })),
                };
            }

            if (table === organizationTable) {
                return {
                    where: mockMissingOrgRows,
                };
            }

            throw new Error(`Unexpected table in test: ${String(table?.__table ?? table)}`);
        }),
    })),
};

mock.module("@repo/database", () => ({
    db: mockDb,
    jsonPositionLatitude: () => ({ __sql: "lat" }),
    jsonPositionLongitude: () => ({ __sql: "lng" }),
}));

mock.module("@repo/database/schema", () => ({
    member: memberTable,
    shiftAssignment: shiftAssignmentTable,
    shift: shiftTable,
    location: locationTable,
    organization: organizationTable,
}));

const { getWorkerAllShifts } = await import("../src/modules/time-tracking/worker-all-shifts");

describe("getWorkerAllShifts", () => {
    beforeEach(() => {
        mockMembershipRows.mockClear();
        mockShiftRows.mockClear();
        mockMissingOrgRows.mockClear();
        mockMembershipRows.mockResolvedValue([
            { orgId: "org_a", role: "member" },
            { orgId: "org_b", role: "member" },
        ]);
        mockMissingOrgRows.mockResolvedValue([]);
    });

    test("reports nested cross-org conflicts, not just adjacent overlaps", async () => {
        mockShiftRows.mockResolvedValue([
            {
                assignment: {
                    id: "asg_a_long",
                    status: "active",
                    breakMinutes: 0,
                    actualClockIn: null,
                    actualClockOut: null,
                    effectiveClockIn: null,
                    effectiveClockOut: null,
                    totalDurationMinutes: null,
                    needsReview: false,
                    reviewReason: null,
                },
                shift: {
                    id: "shift_a_long",
                    title: "Long Org A Shift",
                    description: null,
                    startTime: new Date("2026-06-01T09:00:00.000Z"),
                    endTime: new Date("2026-06-01T17:00:00.000Z"),
                    status: "published",
                },
                location: {
                    id: "loc_a",
                    name: "Venue A",
                    address: "A Street",
                    geofenceRadius: 100,
                    latitude: 40.0,
                    longitude: -73.0,
                },
                organization: {
                    id: "org_a",
                    name: "Org A",
                },
            },
            {
                assignment: {
                    id: "asg_a_short",
                    status: "active",
                    breakMinutes: 0,
                    actualClockIn: null,
                    actualClockOut: null,
                    effectiveClockIn: null,
                    effectiveClockOut: null,
                    totalDurationMinutes: null,
                    needsReview: false,
                    reviewReason: null,
                },
                shift: {
                    id: "shift_a_short",
                    title: "Short Org A Shift",
                    description: null,
                    startTime: new Date("2026-06-01T10:00:00.000Z"),
                    endTime: new Date("2026-06-01T11:00:00.000Z"),
                    status: "published",
                },
                location: {
                    id: "loc_a",
                    name: "Venue A",
                    address: "A Street",
                    geofenceRadius: 100,
                    latitude: 40.0,
                    longitude: -73.0,
                },
                organization: {
                    id: "org_a",
                    name: "Org A",
                },
            },
            {
                assignment: {
                    id: "asg_b_midday",
                    status: "active",
                    breakMinutes: 0,
                    actualClockIn: null,
                    actualClockOut: null,
                    effectiveClockIn: null,
                    effectiveClockOut: null,
                    totalDurationMinutes: null,
                    needsReview: false,
                    reviewReason: null,
                },
                shift: {
                    id: "shift_b_midday",
                    title: "Org B Midday Shift",
                    description: null,
                    startTime: new Date("2026-06-01T12:00:00.000Z"),
                    endTime: new Date("2026-06-01T13:00:00.000Z"),
                    status: "published",
                },
                location: {
                    id: "loc_b",
                    name: "Venue B",
                    address: "B Street",
                    geofenceRadius: 100,
                    latitude: 41.0,
                    longitude: -74.0,
                },
                organization: {
                    id: "org_b",
                    name: "Org B",
                },
            },
        ]);

        const result = await getWorkerAllShifts("worker_1", { status: "upcoming" });

        expect(result.conflicts).toEqual([
            {
                shiftId: "shift_a_long",
                overlapsWithShiftId: "shift_b_midday",
                overlapsWithTitle: "Org B Midday Shift",
                overlapsWithOrg: "Org B",
                overlapStart: "2026-06-01T12:00:00.000Z",
                overlapEnd: "2026-06-01T13:00:00.000Z",
            },
            {
                shiftId: "shift_b_midday",
                overlapsWithShiftId: "shift_a_long",
                overlapsWithTitle: "Long Org A Shift",
                overlapsWithOrg: "Org A",
                overlapStart: "2026-06-01T12:00:00.000Z",
                overlapEnd: "2026-06-01T13:00:00.000Z",
            },
        ]);
    });
});
