
import { describe, expect, test, mock, beforeEach } from "bun:test";
import { clockIn as clockInController } from "../src/services/clock-in";
import { clockOut as clockOutController } from "../src/services/clock-out";

// Mock DB
const mockQuery = mock(() => Promise.resolve<any>(null));
const mockTransaction = mock((cb) => cb({
    update: mockUpdate,
    insert: mockInsert,
    query: { shift: { findFirst: mockQuery }, shiftAssignment: { findMany: mock(() => Promise.resolve([])) } },
    select: mockSelect
}));
const mockUpdate = mock(() => ({
    set: mockSet,
    where: mockWhere,
    returning: mock(() => [{ id: 'assign1' }])
}));
const mockInsert = mock(() => Promise.resolve());
const mockSet = mock(() => ({ where: mockWhere }));
const mockWhere = mock(() => Promise.resolve({ rowCount: 1 }));
const mockSelect = mock(() => ({ from: mockFrom }));
const mockFrom = mock(() => ({ where: mockSelectWhere }));
const mockSelectWhere = mock(() => Promise.resolve([{ isWithin: true, distance: 10, radius: 100 }]));

// Mock Config
mock.module("@repo/database", () => ({
    db: {
        query: {
            shift: { findFirst: mockQuery },
            organization: { findFirst: mock(() => Promise.resolve({ earlyClockInBufferMinutes: 60 })) },
            shiftAssignment: { findMany: mock(() => Promise.resolve([])) }
        },
        transaction: mockTransaction,
        select: mockSelect
    },
    // Mock Schema
    shift: { id: 'shift_id', organizationId: 'org_id', locationId: 'loc_id' },
    shiftAssignment: { id: 'assign_id', workerId: 'worker_id' },
    workerLocation: {},
    location: { id: 'loc_id' },
    organization: { id: 'org_id' }
}));

mock.module("@repo/config", () => ({
    applyClockInRules: () => ({ recordedTime: new Date(), actualTime: new Date(), scheduledTime: new Date(), isEarly: false, isLate: false, minutesDifference: 0 }),
    applyClockOutRules: () => ({ recordedTime: new Date(), actualTime: new Date(), scheduledTime: new Date(), isEarly: false, isLate: false, minutesDifference: 0 }),
    validateShiftTransition: () => true
}));

mock.module("@repo/notifications", () => ({
    cancelNotificationByType: () => Promise.resolve()
}));

mock.module("../src/utils/manager-notifications", () => ({
    notifyManagers: () => Promise.resolve()
}));

mock.module("@repo/observability", () => ({
    logAudit: () => Promise.resolve()
}));

describe("Anti-Spoofing Validation", () => {
    beforeEach(() => {
        mockQuery.mockClear();
    });

    test("Clock-in should reject old timestamps (Replay Attack)", async () => {
        const req = new Request("http://localhost/clock-in", {
            method: "POST",
            body: JSON.stringify({
                shiftId: "s1",
                latitude: "40.7128",
                longitude: "-74.0060",
                accuracyMeters: 10,
                deviceTimestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 mins old
            })
        });

        const payload = await req.json();
        let res: any, json: any;
        try {
            res = await clockInController(payload, "w1", "org1");
            json = res as any;
        } catch (e: any) {
            res = { status: e.statusCode || 400 };
            json = { code: e.code };
        }

        expect(res.status).toBe(400);
        expect(json.code).toBe("REPLAY_DETECTED");
    });

    test("Clock-in should reject low accuracy GPS", async () => {
        const req = new Request("http://localhost/clock-in", {
            method: "POST",
            body: JSON.stringify({
                shiftId: "s1",
                latitude: "40.7128",
                longitude: "-74.0060",
                accuracyMeters: 500, // Too high
                deviceTimestamp: new Date().toISOString()
            })
        });

        const payload = await req.json();
        let res: any, json: any;
        try {
            res = await clockInController(payload, "w1", "org1");
            json = res as any;
        } catch (e: any) {
            res = { status: e.statusCode || 400 };
            json = { code: e.code };
        }

        expect(res.status).toBe(400);
        expect(json.code).toBe("LOW_ACCURACY");
    });
});
