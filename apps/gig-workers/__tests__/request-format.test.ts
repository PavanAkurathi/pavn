import { dayKey, shiftWhen, timeOffWhen } from "../lib/request-format";

const NY = "America/New_York";

describe("request times read the site's clock", () => {
    it("formats a shift in its own timezone", () => {
        expect(shiftWhen({ startTime: "2026-09-29T20:00:00.000Z", endTime: "2026-09-30T03:00:00.000Z", timezone: NY })).toBe(
            "Tue, Sep 29 · 4:00 PM – 11:00 PM",
        );
        expect(dayKey("2026-09-30T03:30:00.000Z", NY)).toBe("2026-09-29");
    });

    it("treats a day off as ending at the next midnight", () => {
        const oneDay = { startTime: "2026-09-29T04:00:00.000Z", endTime: "2026-09-30T04:00:00.000Z", allDay: true, timezone: NY };
        expect(timeOffWhen(oneDay)).toBe("Tue, Sep 29");
        expect(timeOffWhen({ ...oneDay, endTime: "2026-10-02T04:00:00.000Z" })).toBe("Tue, Sep 29 – Thu, Oct 1");
        expect(timeOffWhen({ ...oneDay, allDay: false, startTime: "2026-09-29T18:00:00.000Z", endTime: "2026-09-29T22:00:00.000Z" })).toBe(
            "Tue, Sep 29 · 2:00 PM – 6:00 PM",
        );
    });
});
