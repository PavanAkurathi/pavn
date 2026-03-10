import { beforeEach, describe, expect, mock, test } from "bun:test";
import { clockIn } from "../src/services/clock-in";
import { clockOut } from "../src/services/clock-out";

const shiftFindMock = mock();
const orgFindMock = mock(() => Promise.resolve({ earlyClockInBufferMinutes: 60 }));
const assignmentListMock = mock(() => Promise.resolve([{ actualClockOut: new Date(), status: "completed" }]));
const updatePayloads: any[] = [];
const insertPayloads: any[] = [];

const txUpdateMock = mock(() => ({
    set: (values: Record<string, unknown>) => {
        updatePayloads.push(values);
        return {
            where: () => ({
                returning: () => Promise.resolve([{ id: "assignment-1" }]),
            }),
        };
    },
}));

const txInsertMock = mock(() => ({
    values: (values: Record<string, unknown>) => {
        insertPayloads.push(values);
        return Promise.resolve();
    },
}));

const transactionMock = mock((callback: (tx: any) => Promise<unknown>) =>
    callback({
        update: txUpdateMock,
        insert: txInsertMock,
        query: {
            shiftAssignment: { findMany: assignmentListMock },
        },
    })
);

const selectMock = mock(() => ({
    from: () => ({
        where: () =>
            Promise.resolve([
                { isWithin: true, distance: 8, radius: 100 },
            ]),
    }),
}));

mock.module("@repo/database", () => ({
    db: {
        query: {
            shift: { findFirst: shiftFindMock },
            organization: { findFirst: orgFindMock },
        },
        select: selectMock,
        transaction: transactionMock,
    },
    jsonPositionToGeography: () => "position_geography",
    toLatLng: (lat: number, lng: number) => ({ lat, lng }),
    logAudit: mock(() => Promise.resolve()),
}));

mock.module("@repo/database/schema", () => ({
    shift: { id: "shift_id", organizationId: "org_id" },
    shiftAssignment: { id: "assignment_id", workerId: "worker_id", shiftId: "shift_id", actualClockOut: "actual_clock_out" },
    workerLocation: { id: "id" },
    organization: { id: "org_id" },
    location: { id: "location_id", position: "position", geofenceRadius: "geofence_radius" },
}));

mock.module("@repo/config", () => ({
    applyClockInRules: () => ({
        recordedTime: new Date(),
        actualTime: new Date(),
        scheduledTime: new Date(),
        isEarly: false,
        isLate: false,
        minutesDifference: 0,
    }),
    applyClockOutRules: () => ({
        recordedTime: new Date(),
        actualTime: new Date(),
        scheduledTime: new Date(),
        isEarly: false,
        isLate: false,
        minutesDifference: 0,
    }),
    validateShiftTransition: () => true,
}));

mock.module("@repo/notifications", () => ({
    cancelNotificationByType: () => Promise.resolve(),
}));

mock.module("../src/utils/manager-notifications", () => ({
    notifyManagers: () => Promise.resolve(),
}));

describe("clock-in/out JSON position storage", () => {
    beforeEach(() => {
        shiftFindMock.mockReset();
        orgFindMock.mockClear();
        assignmentListMock.mockClear();
        txUpdateMock.mockClear();
        txInsertMock.mockClear();
        transactionMock.mockClear();
        selectMock.mockClear();
        updatePayloads.length = 0;
        insertPayloads.length = 0;
    });

    test("clockIn stores worker and venue coordinates as JSON objects", async () => {
        const now = Date.now();
        shiftFindMock.mockResolvedValueOnce({
            id: "shift-1",
            status: "assigned",
            locationId: "location-1",
            startTime: new Date(now + 15 * 60 * 1000),
            location: {
                id: "location-1",
                position: { lat: 40.7128, lng: -74.006 },
                geofenceRadius: 100,
            },
            assignments: [
                {
                    id: "assignment-1",
                    actualClockIn: null,
                    worker: { name: "Taylor Worker" },
                },
            ],
        });

        const result = await clockIn(
            {
                shiftId: "shift-1",
                latitude: 40.7128,
                longitude: -74.006,
                accuracyMeters: 12,
                deviceTimestamp: new Date(now).toISOString(),
            },
            "worker-1",
            "org-1"
        );

        expect(result.success).toBe(true);
        expect(updatePayloads.some((payload) => payload.clockInPosition?.lat === 40.7128 && payload.clockInPosition?.lng === -74.006)).toBe(true);
        expect(insertPayloads[0]?.position).toEqual({ lat: 40.7128, lng: -74.006 });
        expect(insertPayloads[0]?.venuePosition).toEqual({ lat: 40.7128, lng: -74.006 });
    });

    test("clockOut stores worker and venue coordinates as JSON objects", async () => {
        const now = Date.now();
        shiftFindMock.mockResolvedValueOnce({
            id: "shift-2",
            status: "in-progress",
            locationId: "location-2",
            endTime: new Date(now + 60 * 60 * 1000),
            location: {
                id: "location-2",
                position: { lat: 34.0522, lng: -118.2437 },
                geofenceRadius: 100,
            },
            assignments: [
                {
                    id: "assignment-2",
                    actualClockIn: new Date(now - 20 * 60 * 1000),
                    actualClockOut: null,
                    breakMinutes: 0,
                    status: "active",
                },
            ],
        });

        const result = await clockOut(
            {
                shiftId: "shift-2",
                latitude: 34.0522,
                longitude: -118.2437,
                accuracyMeters: 10,
                deviceTimestamp: new Date(now).toISOString(),
            },
            "worker-1",
            "org-1"
        );

        expect(result.success).toBe(true);
        expect(updatePayloads.some((payload) => payload.clockOutPosition?.lat === 34.0522 && payload.clockOutPosition?.lng === -118.2437)).toBe(true);
        expect(insertPayloads[0]?.position).toEqual({ lat: 34.0522, lng: -118.2437 });
        expect(insertPayloads[0]?.venuePosition).toEqual({ lat: 34.0522, lng: -118.2437 });
    });
});
