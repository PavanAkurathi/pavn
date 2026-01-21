import { describe, expect, test } from "bun:test";
import { applyClockInRules } from "../src/utils/time-rules";

describe("Geofence Logic", () => {
    describe("applyClockInRules", () => {
        test("detects early clock in", () => {
            const scheduled = new Date("2023-01-01T09:00:00Z");
            const actual = new Date("2023-01-01T08:50:00Z"); // 10 mins early
            const result = applyClockInRules(actual, scheduled);
            expect(result.isEarly).toBe(true);
            expect(result.isLate).toBe(false);
            expect(result.minutesDifference).toBe(-10);
        });

        test("detects late clock in", () => {
            const scheduled = new Date("2023-01-01T09:00:00Z");
            const actual = new Date("2023-01-01T09:05:00Z"); // 5 mins late
            const result = applyClockInRules(actual, scheduled);
            expect(result.isEarly).toBe(false);
            expect(result.isLate).toBe(true);
            expect(result.minutesDifference).toBe(5);
        });
    });
});
