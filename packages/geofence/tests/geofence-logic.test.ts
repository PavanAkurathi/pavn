import { describe, expect, test } from "bun:test";
import { calculateDistance } from "../src/utils/distance";
import { applyClockInRules } from "../src/utils/time-rules";

describe("Geofence Logic", () => {
    describe("calculateDistance", () => {
        test("calculates distance between two points correctly", () => {
            // New York to London approx 5570km
            // NY: 40.7128° N, 74.0060° W
            // London: 51.5074° N, 0.1278° W
            const nyLat = 40.7128;
            const nyLon = -74.0060;
            const lonLat = 51.5074;
            const lonLon = -0.1278;

            const dist = calculateDistance(nyLat, nyLon, lonLat, lonLon);
            expect(dist).toBeGreaterThan(5500000);
            expect(dist).toBeLessThan(5600000);

            // Same point should be 0
            expect(calculateDistance(nyLat, nyLon, nyLat, nyLon)).toBe(0);
        });

        test("calculates short distance correctly (100m)", () => {
            // Approx 1 degree lat = 111km
            // 0.001 degree = 111m
            const lat1 = 40.000;
            const lon1 = -74.000;
            const lat2 = 40.001;
            const lon2 = -74.000;

            const dist = calculateDistance(lat1, lon1, lat2, lon2);
            expect(dist).toBeGreaterThan(100);
            expect(dist).toBeLessThan(120);
        });
    });

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
