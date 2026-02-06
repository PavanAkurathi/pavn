import { describe, expect, it } from "bun:test";
import { expandRecurringDates, RecurrenceConfig } from "./recurrence";

describe("expandRecurringDates", () => {
    it("should return base dates if recurrence is disabled", () => {
        const baseDates = ["2026-01-01"];
        const result = expandRecurringDates(baseDates, undefined);
        expect(result).toEqual(baseDates);
    });

    it("should expand weekly recurrence for fixed weeks", () => {
        // Start on Sunday Jan 4 2026
        const baseDates = ["2026-01-04"];
        const config: RecurrenceConfig = {
            enabled: true,
            pattern: "weekly",
            daysOfWeek: [0], // Sunday
            endType: "after_weeks",
            endAfter: 3
        };

        const result = expandRecurringDates(baseDates, config);
        // Expect Jan 4, Jan 11, Jan 18
        expect(result).toEqual(["2026-01-04", "2026-01-11", "2026-01-18"]);
    });

    it("should expand biweekly recurrence", () => {
        // Start on Sunday Jan 4 2026
        const baseDates = ["2026-01-04"];
        const config: RecurrenceConfig = {
            enabled: true,
            pattern: "biweekly",
            daysOfWeek: [0], // Sunday
            endType: "after_weeks",
            endAfter: 3
        };

        // Weeks:
        // 0: Jan 4 (Include)
        // 1: Jan 11 (Skip - Biweekly)
        // 2: Jan 18 (Include)
        // 3: Jan 25 (Skip) - wait, logic is simple multiplication
        // Week 0: +0 days -> Jan 4
        // Week 1: +14 days -> Jan 18
        // Week 2: +28 days -> Feb 1

        const result = expandRecurringDates(baseDates, config);
        expect(result).toEqual(["2026-01-04", "2026-01-18", "2026-02-01"]);
    });

    it("should respect end date", () => {
        // Start Mon Jan 5 2026
        const baseDates = ["2026-01-05"];
        const config: RecurrenceConfig = {
            enabled: true,
            pattern: "weekly",
            daysOfWeek: [1], // Monday
            endType: "on_date",
            endDate: "2026-01-20"
        };

        // Jan 5, Jan 12, Jan 19. (Jan 26 is after Jan 20)
        const result = expandRecurringDates(baseDates, config);
        expect(result).toEqual(["2026-01-05", "2026-01-12", "2026-01-19"]);
    });

    it("should generate multiple days per week", () => {
        // Start Mon Jan 5 2026
        const baseDates = ["2026-01-05"];
        const config: RecurrenceConfig = {
            enabled: true,
            pattern: "weekly",
            daysOfWeek: [1, 5], // Mon, Fri
            endType: "after_weeks",
            endAfter: 2
        };

        // Week 1: Jan 5 (Mon), Jan 9 (Fri)
        // Week 2: Jan 12 (Mon), Jan 16 (Fri)
        const result = expandRecurringDates(baseDates, config);
        expect(result).toEqual(["2026-01-05", "2026-01-09", "2026-01-12", "2026-01-16"]);
    });
});
