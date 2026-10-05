import { describe, expect, test } from "bun:test";
import { localToday, zonedInstant } from "./zoned";

describe("zonedInstant", () => {
    test("New York in daylight time is four hours behind UTC", () => {
        expect(zonedInstant("2026-10-16", "16:30", "America/New_York").toISOString()).toBe("2026-10-16T20:30:00.000Z");
    });

    test("and five hours behind in winter", () => {
        expect(zonedInstant("2026-12-01", "09:00", "America/New_York").toISOString()).toBe("2026-12-01T14:00:00.000Z");
    });

    test("either side of the clocks going back", () => {
        // Clocks go back on Sunday November 1, 2026 at 2am.
        expect(zonedInstant("2026-11-01", "00:30", "America/New_York").toISOString()).toBe("2026-11-01T04:30:00.000Z");
        expect(zonedInstant("2026-11-01", "03:00", "America/New_York").toISOString()).toBe("2026-11-01T08:00:00.000Z");
    });

    test("a site ahead of UTC", () => {
        expect(zonedInstant("2026-10-16", "09:00", "Australia/Sydney").toISOString()).toBe("2026-10-15T22:00:00.000Z");
    });
});

describe("localToday", () => {
    test("the date at the site, not in UTC", () => {
        // 01:00Z on Oct 17 is still the evening of Oct 16 in New York.
        expect(localToday("America/New_York", new Date("2026-10-17T01:00:00.000Z"))).toBe("2026-10-16");
        expect(localToday("Australia/Sydney", new Date("2026-10-17T01:00:00.000Z"))).toBe("2026-10-17");
    });
});
