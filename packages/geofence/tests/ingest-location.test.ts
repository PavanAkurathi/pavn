import { beforeEach, describe, expect, mock, test } from "bun:test";
import { ingestLocation } from "../src/services/ingest-location";

const pushNotificationMock = mock(() => Promise.resolve());
const memberFindMock = mock(() =>
    Promise.resolve({
        user: { id: "worker-1", name: "Taylor Worker" },
    })
);
const previousPingFindMock = mock(() => Promise.resolve(null));
const updatePayloads: any[] = [];
const insertPayloads: any[] = [];

const updateMock = mock(() => ({
    set: (values: Record<string, unknown>) => {
        updatePayloads.push(values);
        return {
            where: () => Promise.resolve(),
        };
    },
}));

const insertMock = mock(() => ({
    values: (values: Record<string, unknown>) => {
        insertPayloads.push(values);
        return Promise.resolve();
    },
}));

const selectMock = mock();

mock.module("@repo/notifications", () => ({
    sendPushNotification: pushNotificationMock,
}));

mock.module("@repo/database", () => ({
    db: {
        query: {
            member: { findFirst: memberFindMock },
            workerLocation: { findFirst: previousPingFindMock },
        },
        select: selectMock,
        update: updateMock,
        insert: insertMock,
    },
    jsonPositionToGeography: () => "position_geography",
    toLatLng: (lat: number, lng: number) => ({ lat, lng }),
}));

mock.module("@repo/database/schema", () => ({
    workerLocation: { workerId: "worker_id", shiftId: "shift_id", recordedAt: "recorded_at", id: "id" },
    shiftAssignment: { workerId: "worker_id", shiftId: "shift_id", id: "id" },
    shift: { id: "id", locationId: "location_id", startTime: "start_time", endTime: "end_time" },
    member: { userId: "user_id", organizationId: "organization_id" },
    location: { id: "id", position: "position", geofenceRadius: "geofence_radius", name: "name" },
}));

describe("ingestLocation", () => {
    beforeEach(() => {
        pushNotificationMock.mockClear();
        memberFindMock.mockClear();
        previousPingFindMock.mockClear();
        updateMock.mockClear();
        insertMock.mockClear();
        selectMock.mockReset();
        updatePayloads.length = 0;
        insertPayloads.length = 0;
    });

    test("sends an arrival push and stores JSON coordinates when a worker reaches the venue", async () => {
        const shiftStart = new Date(Date.now() + 15 * 60 * 1000);
        const shiftEnd = new Date(Date.now() + 2 * 60 * 60 * 1000);
        const activeAssignments = [
            {
                assignment: {
                    id: "assignment-1",
                    actualClockIn: null,
                    actualClockOut: null,
                    reviewReason: null,
                },
                shift: {
                    id: "shift-1",
                    startTime: shiftStart,
                    endTime: shiftEnd,
                    locationId: "location-1",
                },
                location: {
                    id: "location-1",
                    name: "Test Venue",
                    position: { lat: 40.7128, lng: -74.006 },
                    geofenceRadius: 100,
                },
            },
        ];

        selectMock
            .mockImplementationOnce(() => ({
                from: () => ({
                    innerJoin: () => ({
                        leftJoin: () => ({
                            where: () => ({
                                orderBy: () => Promise.resolve(activeAssignments),
                            }),
                        }),
                    }),
                }),
            }))
            .mockImplementationOnce(() => ({
                from: () => ({
                    where: () =>
                        Promise.resolve([
                            { isWithin: true, distance: 12, radius: 100 },
                        ]),
                }),
            }));

        const result = await ingestLocation(
            {
                latitude: 40.7128,
                longitude: -74.006,
                accuracyMeters: 15,
                deviceTimestamp: new Date().toISOString(),
            },
            "worker-1",
            "org-1"
        );

        expect(result.success).toBe(true);
        expect(result.data.eventType).toBe("arrival");
        expect(pushNotificationMock).toHaveBeenCalledTimes(1);
        expect(insertPayloads[0]?.position).toEqual({ lat: 40.7128, lng: -74.006 });
        expect(insertPayloads[0]?.venuePosition).toEqual({ lat: 40.7128, lng: -74.006 });
        expect(updatePayloads).toHaveLength(0);
    });

    test("flags a departure with JSON last-known coordinates and does not send a push", async () => {
        const shiftStart = new Date(Date.now() - 30 * 60 * 1000);
        const shiftEnd = new Date(Date.now() + 60 * 60 * 1000);
        const activeAssignments = [
            {
                assignment: {
                    id: "assignment-2",
                    actualClockIn: new Date(Date.now() - 20 * 60 * 1000),
                    actualClockOut: null,
                    reviewReason: null,
                },
                shift: {
                    id: "shift-2",
                    startTime: shiftStart,
                    endTime: shiftEnd,
                    locationId: "location-2",
                },
                location: {
                    id: "location-2",
                    name: "Night Shift Venue",
                    position: { lat: 41.0, lng: -73.9 },
                    geofenceRadius: 100,
                },
            },
        ];

        previousPingFindMock.mockResolvedValueOnce({ isOnSite: true });

        selectMock
            .mockImplementationOnce(() => ({
                from: () => ({
                    innerJoin: () => ({
                        leftJoin: () => ({
                            where: () => ({
                                orderBy: () => Promise.resolve(activeAssignments),
                            }),
                        }),
                    }),
                }),
            }))
            .mockImplementationOnce(() => ({
                from: () => ({
                    where: () =>
                        Promise.resolve([
                            { isWithin: false, distance: 320, radius: 100 },
                        ]),
                }),
            }));

        const result = await ingestLocation(
            {
                latitude: 40.5,
                longitude: -74.2,
                accuracyMeters: 20,
                deviceTimestamp: new Date().toISOString(),
            },
            "worker-1",
            "org-1"
        );

        expect(result.success).toBe(true);
        expect(result.data.eventType).toBe("departure");
        expect(pushNotificationMock).not.toHaveBeenCalled();
        expect(updatePayloads[0]?.reviewReason).toBe("left_geofence");
        expect(updatePayloads[0]?.lastKnownPosition).toEqual({ lat: 40.5, lng: -74.2 });
        expect(insertPayloads[0]?.position).toEqual({ lat: 40.5, lng: -74.2 });
    });
});
