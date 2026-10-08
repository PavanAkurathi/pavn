import { describe, expect, test } from "bun:test";
import { hourRange, hourToLocal, minutesNow, packLanes, placeSpan, spanOf } from "./day-timeline";

describe("a shift on a row of hours", () => {
    test("an end at or before the start runs into the next day", () => {
        expect(spanOf("17:00", "23:00")).toEqual({ start: 1020, end: 1380 });
        expect(spanOf("21:00", "02:00")).toEqual({ start: 1260, end: 1560 });
        expect(spanOf("09:00", "09:00")).toEqual({ start: 540, end: 1980 });
    });

    test("the row shows 8am to 10pm unless a shift reaches further", () => {
        expect(hourRange([])).toEqual({ from: 8, to: 22 });
        expect(hourRange([spanOf("11:00", "16:00"), spanOf("17:00", "23:00")])).toEqual({ from: 8, to: 23 });
        expect(hourRange([spanOf("06:30", "14:00"), spanOf("21:00", "02:15")])).toEqual({ from: 6, to: 27 });
    });

    test("placed as a share of the row, clipped at its ends", () => {
        const range = { from: 8, to: 24 };
        expect(placeSpan(spanOf("08:00", "16:00"), range)).toEqual({ left: 0, width: 50 });
        expect(placeSpan(spanOf("20:00", "02:00"), range)).toEqual({ left: 75, width: 25 });
    });

    test("overlapping shifts stack; back-to-back ones share a lane", () => {
        const spans = [spanOf("17:00", "23:00"), spanOf("11:00", "16:00"), spanOf("16:00", "20:00"), spanOf("18:00", "22:00")];
        expect(packLanes(spans)).toEqual({ lanes: [1, 0, 0, 2], count: 3 });
        expect(packLanes([])).toEqual({ lanes: [], count: 1 });
    });

    test("an hour past midnight is the next day's wall clock", () => {
        expect(hourToLocal(9)).toBe("09:00");
        expect(hourToLocal(26)).toBe("02:00");
    });

    test("now, on the site's clock", () => {
        expect(minutesNow("America/New_York", new Date("2026-10-07T22:05:00Z"))).toBe(18 * 60 + 5);
    });
});
