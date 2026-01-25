import { describe, it, expect, setSystemTime, beforeAll, afterAll, mock } from "bun:test";
import { buildNotificationSchedule } from "../src/services/scheduler";
import { addHours, subDays, setHours, setMinutes } from "date-fns";

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

// We can also mock specific internal functions if we exported them, but mocking the DB is better integration-like.

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

    it("should generate all 5 notifications for a shift far in the future", async () => {
        // Shift is 3 days from now
        const shiftStart = new Date("2026-06-04T12:00:00Z");

        const notifications = await buildNotificationSchedule(
            workerId, shiftId, orgId, shiftStart, shiftTitle, venueName
        );

        expect(notifications.length).toBe(5);
        const types = notifications.map(n => n.type);
        expect(types).toContain("night_before");
        expect(types).toContain("60_min");
        expect(types).toContain("15_min");
        expect(types).toContain("shift_start");
        expect(types).toContain("late_warning");
    });

    it("should skip 'night_before' if shift is tomorrow but 8PM has passed", async () => {
        // Current Time: June 1st 12:00 PM
        // Shift Start: June 2nd 09:00 AM
        // Night Before: June 1st 08:00 PM (20:00) -> In Future. Should exist.

        // Let's advance "Now" to June 1st 10:00 PM (22:00)
        setSystemTime(new Date("2026-06-01T22:00:00Z"));

        const shiftStart = new Date("2026-06-02T09:00:00Z");

        const notifications = await buildNotificationSchedule(
            workerId, shiftId, orgId, shiftStart, shiftTitle, venueName
        );

        // Night before (June 1st 20:00) is now in the past. Should be skipped.
        const types = notifications.map(n => n.type);
        expect(types).not.toContain("night_before");
        expect(types).toContain("shift_start");
    });

    it("should skip 'night_before' if quiet hours are enabled and it falls within them", async () => {
        // Re-mock DB for this test to enable quiet hours
        mock.module("@repo/database", () => ({
            db: {
                query: {
                    workerNotificationPreferences: {
                        findFirst: async () => ({
                            nightBeforeEnabled: true,
                            quietHoursEnabled: true,
                            quietHoursStart: "19:00", // 7 PM
                            quietHoursEnd: "07:00",   // 7 AM next day
                        })
                    }
                }
            }
        }));

        setSystemTime(new Date("2026-06-01T12:00:00Z"));
        const shiftStart = new Date("2026-06-04T12:00:00Z"); // Night before is 20:00

        const notifications = await buildNotificationSchedule(
            workerId, shiftId, orgId, shiftStart, shiftTitle, venueName
        );

        // 20:00 is inside 19:00-07:00. Should skip.
        const types = notifications.map(n => n.type);
        expect(types).not.toContain("night_before");
    });
});
