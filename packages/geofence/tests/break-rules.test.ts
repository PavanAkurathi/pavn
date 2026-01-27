import { describe, expect, test } from "bun:test";
import { enforceBreakRules } from "@repo/config";

describe("Break Enforcement Rules", () => {
    test("Should not enforce break for shift < 6 hours", () => {
        const start = new Date("2024-01-01T09:00:00Z");
        const end = new Date("2024-01-01T14:59:00Z"); // 5h 59m

        const result = enforceBreakRules(start, end, 0);

        expect(result.wasEnforced).toBe(false);
        expect(result.breakMinutes).toBe(0);
    });

    test("Should enforce 30 min break for shift >= 6 hours", () => {
        const start = new Date("2024-01-01T09:00:00Z");
        const end = new Date("2024-01-01T15:00:00Z"); // 6h 00m

        const result = enforceBreakRules(start, end, 0);

        expect(result.wasEnforced).toBe(true);
        expect(result.breakMinutes).toBe(30);
        expect(result.reason).toContain("Mandatory 30min break");
    });

    test("Should respect recorded breaks > 0", () => {
        const start = new Date("2024-01-01T09:00:00Z");
        const end = new Date("2024-01-01T17:00:00Z"); // 8h

        // Worker took 45 min break
        const result = enforceBreakRules(start, end, 45);

        expect(result.wasEnforced).toBe(false);
        expect(result.breakMinutes).toBe(45);
    });

    test("Should respect recorded breaks even if small (e.g. 15min)", () => {
        const start = new Date("2024-01-01T09:00:00Z");
        const end = new Date("2024-01-01T17:00:00Z"); // 8h

        // Worker took 15 min break manually (maybe split break?)
        // Logic says: if recorded > 0, trust it.
        const result = enforceBreakRules(start, end, 15);

        expect(result.wasEnforced).toBe(false);
        expect(result.breakMinutes).toBe(15);
    });
});
