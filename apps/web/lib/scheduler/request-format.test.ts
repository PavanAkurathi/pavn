import { describe, expect, test } from "bun:test";
import { shiftWhen, timeAgo, timeOffWhen, wallClock } from "./request-format";

const NY = "America/New_York";

describe("request times read the wall clock where they happen", () => {
    test("a shift in New York, whatever the browser's zone", () => {
        expect(shiftWhen({ startTime: "2026-09-29T20:00:00.000Z", endTime: "2026-09-30T03:00:00.000Z", timezone: NY })).toBe("Tue Sep 29 · 4p–11p");
        expect(wallClock("2026-09-30T03:30:00.000Z", NY)).toEqual({ date: "2026-09-29", time: "23:30" });
    });

    test("whole days off end at the next midnight", () => {
        const oneDay = { startTime: "2026-09-29T04:00:00.000Z", endTime: "2026-09-30T04:00:00.000Z", allDay: true, timezone: NY };
        expect(timeOffWhen(oneDay)).toBe("Tue Sep 29 · all day");
        expect(timeOffWhen({ ...oneDay, endTime: "2026-10-02T04:00:00.000Z" })).toBe("Tue Sep 29 – Thu Oct 1");
    });

    test("part of a day, and across midnight", () => {
        const window = { startTime: "2026-09-29T18:00:00.000Z", endTime: "2026-09-29T22:00:00.000Z", allDay: false, timezone: NY };
        expect(timeOffWhen(window)).toBe("Tue Sep 29 · 2p–6p");
        expect(timeOffWhen({ ...window, endTime: "2026-09-30T14:00:00.000Z" })).toBe("Tue Sep 29 2p – Wed Sep 30 10a");
    });

    test("how long ago", () => {
        const now = new Date("2026-09-29T12:00:00.000Z");
        expect(timeAgo("2026-09-29T11:59:40.000Z", now)).toBe("just now");
        expect(timeAgo("2026-09-29T11:15:00.000Z", now)).toBe("45m ago");
        expect(timeAgo("2026-09-29T07:00:00.000Z", now)).toBe("5h ago");
        expect(timeAgo("2026-09-26T12:00:00.000Z", now)).toBe("3d ago");
    });
});
