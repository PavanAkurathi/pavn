import { describe, it, expect, setSystemTime, beforeAll, afterAll, mock } from "bun:test";
import { buildNotificationSchedule } from "../src/services/scheduler";
import { addHours, subDays, setHours, setMinutes, addMinutes } from "date-fns";

// Mock the DB module
mock.module("@repo/database", () => ({
    db: {
        query: {
            workerNotificationPreferences: {
                findFirst: async () => null // Default to defaults (all enabled, no quiet hours)
            }
        }
    }
}));

describe("buildNotificationSchedule", () => {
    const workerId = "test-worker";
    const shiftId = "test-shift";
    const orgId = "test-org";
    const shiftTitle = "Guard Duty";
    const venueName = "Stadium";

    beforeAll(() => {
        // Mock "Now" to be fixed: 2026-06-01 12:00:00 (Noon)
        setSystemTime(new Date("2026-06-01T12:00:00Z"));
    });

    afterAll(() => {
        setSystemTime(); // reset
    });

    it("should generate all 6 notifications for a shift far in the future", async () => {
        // Shift is 3 days from now
        const shiftStart = new Date("2026-06-04T12:00:00Z");

        const notifications = await buildNotificationSchedule(
            workerId, shiftId, orgId, shiftStart, shiftTitle, venueName
        );

        expect(notifications.length).toBe(6);
        const types = notifications.map(n => n.type);
        expect(types).toContain("assignment_created");
        expect(types).toContain("night_before");
        expect(types).toContain("60_min");
        expect(types).toContain("15_min");
        expect(types).toContain("shift_start");
        expect(types).toContain("late_warning");
    });

    it("should schedule 'late_warning' 30 minutes after shift start", async () => {
        const shiftStart = new Date("2026-06-04T12:00:00Z");

        const notifications = await buildNotificationSchedule(
            workerId, shiftId, orgId, shiftStart, shiftTitle, venueName
        );

        const late = notifications.find(n => n.type === 'late_warning');
        expect(late).toBeDefined();

        // Expected: Start + 30 mins
        const expected = addMinutes(shiftStart, 30);
        expect(late?.scheduledAt.toISOString()).toBe(expected.toISOString());
        expect(late?.body).toContain("Looks like you forgot to clock in");
    });

    it("should have correct copy for 'assignment_created'", async () => {
        const shiftStart = new Date("2026-06-04T12:00:00Z");

        const notifications = await buildNotificationSchedule(
            workerId, shiftId, orgId, shiftStart, shiftTitle, venueName
        );

        const created = notifications.find(n => n.type === 'assignment_created');
        expect(created).toBeDefined();
        expect(created?.title).toBe("New Shift Scheduled");
        expect(created?.body).toContain("You've been scheduled for Guard Duty at Stadium");

        // Scheduled slightly in future (1 min)
        const now = new Date("2026-06-01T12:00:00Z");
        const expected = addMinutes(now, 1);
        expect(created?.scheduledAt.toISOString()).toBe(expected.toISOString());
    });

    it("should have correct copy for 'shift_start'", async () => {
        const shiftStart = new Date("2026-06-04T12:00:00Z");

        const notifications = await buildNotificationSchedule(
            workerId, shiftId, orgId, shiftStart, shiftTitle, venueName
        );

        const start = notifications.find(n => n.type === 'shift_start');
        expect(start).toBeDefined();
        expect(start?.title).toBe("You need to arrive");
        expect(start?.body).toBe("Arrived at Stadium? Clock in when ready");
    });
});
