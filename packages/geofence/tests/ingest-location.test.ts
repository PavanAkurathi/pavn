import { describe, expect, test, mock, beforeEach } from "bun:test";
import { ingestLocation as ingestLocationController } from "../src/services/ingest-location";

// Mocks
const mockSendSMS = mock(() => Promise.resolve());
mock.module("@repo/auth", () => ({
    sendSMS: mockSendSMS
}));

const mockMemberFind = mock(() => Promise.resolve({
    user: { id: "u1", name: "John", phoneNumber: "+15555555555" }
}));

const mockAssignmentFind = mock(() => Promise.resolve(null as any));
const mockLocationFind = mock(() => Promise.resolve(null as any));
const mockInsert = mock(() => ({ values: () => Promise.resolve() }));
const mockUpdate = mock(() => ({
    set: () => ({
        where: () => Promise.resolve()
    })
}));

// Mock db.select chain
// db.select().from().where() -> returns [geoResult]
const mockSelect = mock(() => ({
    from: () => ({
        where: () => Promise.resolve([{
            isWithin: true,
            distance: 50,
            radius: 100
        }])
    })
}));

mock.module("@repo/database", () => ({
    db: {
        query: {
            member: { findFirst: mockMemberFind },
            shiftAssignment: { findFirst: mockAssignmentFind },
            workerLocation: { findFirst: mockLocationFind },
        },
        insert: mockInsert,
        update: mockUpdate,
        select: mockSelect,
    },
    member: { userId: "userId", organizationId: "organizationId" },
    shiftAssignment: { workerId: "workerId", status: "status", id: "id" },
    workerLocation: { workerId: "workerId", shiftId: "shiftId", recordedAt: "recordedAt" },
    shift: { id: "id", organizationId: "organizationId" },
    location: { id: "id", position: "position", geofenceRadius: "geofenceRadius" }
}));


describe("Ingest Location Controller - Departure", () => {
    beforeEach(() => {
        mockSendSMS.mockClear();
        mockUpdate.mockClear();
        mockAssignmentFind.mockClear();
        mockLocationFind.mockClear();
        mockSelect.mockClear();
    });

    const mockRequest = (body: any) => new Request("http://localhost/location", {
        method: "POST",
        body: JSON.stringify(body)
    });

    test("triggers departure notification when leaving geofence", async () => {
        // Setup: User is clocked in and active
        const mockShift = {
            id: "s1",
            startTime: new Date(Date.now() - 3600000), // Started 1hr ago
            endTime: new Date(Date.now() + 3600000),
            locationId: "l1",
            location: {
                id: "l1",
                name: "Test Venue",
                position: "POINT(0 0)",
                geofenceRadius: 100
            }
        };

        const mockAssignment = {
            id: "a1",
            status: "active",
            actualClockIn: new Date(Date.now() - 3000000),
            actualClockOut: null,
            shift: mockShift,
            reviewReason: null // Not yet flagged
        };

        mockAssignmentFind.mockResolvedValue(mockAssignment);

        // Previous ping was ON SITE
        mockLocationFind.mockResolvedValue({ isOnSite: true });

        // IMPORTANT: We need mockSelect to return "isWithin: false" for this test case (Departure)
        // But mockSelect is global. We can override implementation per test if needed.
        // Or we can mock the values returned based on input?
        // Since we are checking DEPARTURE, line 133 condition is: !isOnSite && clockIn && !clockOut.
        // So isOnSite must be false.
        // So db.select check should return isWithin: false.

        mockSelect.mockImplementationOnce(() => ({
            from: () => ({
                where: () => Promise.resolve([{
                    isWithin: false,
                    distance: 500, // far away
                    radius: 100
                }])
            })
        }));


        // User is now FAR AWAY
        const req = mockRequest({ latitude: "41.000", longitude: "-74.000" });

        const payload = await req.json();
        const res = await ingestLocationController(payload, "u1", "org1") as any;

        expect(res.success).toBe(true);
        expect(res.data.eventType).toBe('departure');
        expect(mockSendSMS).toHaveBeenCalledTimes(1);
        // Cast to any to bypass strict tuple checks on mock.calls
        const calls = mockSendSMS.mock.calls as any[];
        if (calls.length > 0 && calls[0].length > 1) {
            const messageArg = calls[0][1] as string;
            expect(messageArg).toContain("left the venue");
        }
    });

    test("prevents duplicate notification if already flagged", async () => {
        // Setup: User is clocked in and active BUT already flagged
        const mockShift = {
            id: "s1",
            startTime: new Date(Date.now() - 3600000),
            endTime: new Date(Date.now() + 3600000),
            locationId: "l1",
            location: {
                id: "l1",
                name: "Test Venue",
                position: "POINT(0 0)",
                geofenceRadius: 100
            }
        };

        const mockAssignment = {
            id: "a1",
            status: "active",
            actualClockIn: new Date(Date.now() - 3000000),
            actualClockOut: null,
            shift: mockShift,
            reviewReason: 'left_geofence' // ALREADY FLAGGED
        };

        mockAssignmentFind.mockResolvedValue(mockAssignment);
        mockLocationFind.mockResolvedValue({ isOnSite: true });

        // Mock departure again
        mockSelect.mockImplementationOnce(() => ({
            from: () => ({
                where: () => Promise.resolve([{
                    isWithin: false,
                    distance: 500,
                    radius: 100
                }])
            })
        }));

        const req = mockRequest({ latitude: "41.000", longitude: "-74.000" });
        const payload = await req.json();
        await ingestLocationController(payload, "u1", "org1");

        expect(mockSendSMS).not.toHaveBeenCalled();
    });
});
