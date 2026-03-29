import { describe, expect, it } from "bun:test";
import { expandRecurringDates, RecurrenceConfig } from "../src/utils/recurrence";

describe("expandRecurringDates", () => {
    it("should return base dates if recurrence is disabled", () => {
        const baseDates = ["2026-01-01"];
        const result = expandRecurringDates(baseDates, undefined);
        expect(result).toEqual(baseDates);
    });

    it("should expand weekly recurrence for fixed weeks", () => {
        const baseDates = ["2026-01-04"];
        const config: RecurrenceConfig = {
            enabled: true,
            pattern: "weekly",
            daysOfWeek: [0],
            endType: "after_weeks",
            endAfter: 3
        };

        const result = expandRecurringDates(baseDates, config);
        expect(result).toEqual(["2026-01-04", "2026-01-11", "2026-01-18"]);
    });

    it("should expand biweekly recurrence", () => {
        const baseDates = ["2026-01-04"];
        const config: RecurrenceConfig = {
            enabled: true,
            pattern: "biweekly",
            daysOfWeek: [0],
            endType: "after_weeks",
            endAfter: 3
        };

        const result = expandRecurringDates(baseDates, config);
        expect(result).toEqual(["2026-01-04", "2026-01-18", "2026-02-01"]);
    });

    it("should respect end date", () => {
        const baseDates = ["2026-01-05"];
        const config: RecurrenceConfig = {
            enabled: true,
            pattern: "weekly",
            daysOfWeek: [1],
            endType: "on_date",
            endDate: "2026-01-20"
        };

        const result = expandRecurringDates(baseDates, config);
        expect(result).toEqual(["2026-01-05", "2026-01-12", "2026-01-19"]);
    });

    it("should generate multiple days per week", () => {
        const baseDates = ["2026-01-05"];
        const config: RecurrenceConfig = {
            enabled: true,
            pattern: "weekly",
            daysOfWeek: [1, 5],
            endType: "after_weeks",
            endAfter: 2
        };

        const result = expandRecurringDates(baseDates, config);
        expect(result).toEqual(["2026-01-05", "2026-01-09", "2026-01-12", "2026-01-16"]);
    });
});
