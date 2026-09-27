import { describe, expect, test } from "bun:test";

import {
    dayIndexOf,
    dayOfWeek,
    diffLocalDays,
    isLocalDate,
    splitIntoDaySpans,
    startOfLocalWeek,
    weekBounds,
    weekDates,
} from "../src/domain/week";
import { addedOvertimeMinutes, paidMinutes, summarizeWeek, type WorkInterval } from "../src/domain/hours";
import { evaluateConflicts, hasBlockingConflict, overlaps, type ConflictContext } from "../src/domain/conflicts";
import { compactHours, compactRange, compactTime, dayName } from "../src/domain/labels";

const NY = "America/New_York";
const at = (iso: string) => new Date(iso);

describe("scheduling weeks", () => {
    test("validates local dates, including impossible ones", () => {
        expect(isLocalDate("2026-09-27")).toBe(true);
        expect(isLocalDate("2026-02-30")).toBe(false);
        expect(isLocalDate("27/09/2026")).toBe(false);
    });

    test("finds the first day of the week for Sunday- and Monday-start weeks", () => {
        // 2026-09-30 is a Wednesday.
        expect(dayOfWeek("2026-09-30")).toBe(3);
        expect(startOfLocalWeek("2026-09-30", 0)).toBe("2026-09-27");
        expect(startOfLocalWeek("2026-09-30", 1)).toBe("2026-09-28");
        // A date that already starts the week stays put.
        expect(startOfLocalWeek("2026-09-27", 0)).toBe("2026-09-27");
        expect(weekDates("2026-09-27")).toEqual([
            "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03",
        ]);
        expect(diffLocalDays("2026-09-27", "2026-10-03")).toBe(6);
    });

    test("keeps local midnight at both ends of a week that crosses the end of daylight time", () => {
        // US daylight time ends on Sunday 2026-11-01.
        const { start, end } = weekBounds("2026-11-01", NY);
        expect(start.toISOString()).toBe("2026-11-01T04:00:00.000Z"); // 00:00 EDT
        expect(end.toISOString()).toBe("2026-11-08T05:00:00.000Z"); // 00:00 EST
        expect((end.getTime() - start.getTime()) / 3_600_000).toBe(7 * 24 + 1);
    });

    test("places an instant on its local day, not its UTC day", () => {
        // 23:30 in New York on Monday is already Tuesday in UTC.
        expect(dayIndexOf(at("2026-09-29T03:30:00Z"), "2026-09-27", NY)).toBe(1);
        expect(dayIndexOf(at("2026-09-26T12:00:00Z"), "2026-09-27", NY)).toBe(-1);
    });

    test("splits time off into one span per local day, clipped to the week", () => {
        // Friday 17:00 to Sunday 12:00 local; Sunday is the next week.
        const spans = splitIntoDaySpans(at("2026-10-02T21:00:00Z"), at("2026-10-04T16:00:00Z"), "2026-09-27", NY);
        expect(spans).toEqual([
            { dayIndex: 5, startLocal: "17:00", endLocal: "24:00", wholeDay: false },
            { dayIndex: 6, startLocal: "00:00", endLocal: "24:00", wholeDay: true },
        ]);
    });
});

describe("scheduled hours", () => {
    const day = (localDate: string, startIso: string, endIso: string, breakMinutes = 30): WorkInterval => ({
        localDate,
        start: at(startIso),
        end: at(endIso),
        breakMinutes,
    });

    test("paid minutes subtract the unpaid break and never go negative", () => {
        expect(paidMinutes(day("2026-09-28", "2026-09-28T13:00:00Z", "2026-09-28T21:00:00Z"))).toBe(450);
        expect(paidMinutes(day("2026-09-28", "2026-09-28T13:00:00Z", "2026-09-28T13:10:00Z", 30))).toBe(0);
    });

    test("weekly_40 counts everything past 40 hours", () => {
        // Five 9-hour days with a 30-minute break: 42.5 paid hours.
        const week = [28, 29, 30].map((d) => day(`2026-09-${d}`, `2026-09-${d}T13:00:00Z`, `2026-09-${d}T22:00:00Z`))
            .concat([1, 2].map((d) => day(`2026-10-0${d}`, `2026-10-0${d}T13:00:00Z`, `2026-10-0${d}T22:00:00Z`)));
        expect(summarizeWeek(week, "weekly_40")).toEqual({ scheduledMinutes: 2550, overtimeMinutes: 150 });
    });

    test("daily_8 counts past 8 hours in a day, adding up split shifts", () => {
        const week = [
            day("2026-09-28", "2026-09-28T13:00:00Z", "2026-09-28T18:00:00Z", 0), // 5h
            day("2026-09-28", "2026-09-28T20:00:00Z", "2026-09-29T01:00:00Z", 0), // 5h, same local day
            day("2026-09-29", "2026-09-29T13:00:00Z", "2026-09-29T20:00:00Z", 0), // 7h
        ];
        expect(summarizeWeek(week, "daily_8")).toEqual({ scheduledMinutes: 1020, overtimeMinutes: 120 });
        expect(summarizeWeek(week, "weekly_40").overtimeMinutes).toBe(0);
    });

    test("reports only the overtime a new shift would add", () => {
        const existing = [28, 29, 30, 1].map((d) =>
            d < 10
                ? day(`2026-10-0${d}`, `2026-10-0${d}T12:00:00Z`, `2026-10-0${d}T22:30:00Z`)
                : day(`2026-09-${d}`, `2026-09-${d}T12:00:00Z`, `2026-09-${d}T22:30:00Z`),
        ); // 4 × 10h paid = 40h
        const extra = day("2026-10-02", "2026-10-02T13:00:00Z", "2026-10-02T17:00:00Z", 0);
        expect(addedOvertimeMinutes(existing, extra, "weekly_40")).toBe(240);
        expect(addedOvertimeMinutes([], extra, "weekly_40")).toBe(0);
    });
});

describe("conflicts", () => {
    const empty: ConflictContext = {
        personRoles: ["Server"],
        otherShifts: [],
        timeOff: [],
        unavailable: [],
        addedOvertimeMinutes: 0,
    };
    // Friday 18:00 – Saturday 02:00 New York.
    const overnight = { start: at("2026-10-02T22:00:00Z"), end: at("2026-10-03T06:00:00Z"), role: "Server" };

    test("a clean shift has no warnings", () => {
        expect(evaluateConflicts(overnight, empty)).toEqual([]);
    });

    test("catches an overlap that crosses midnight", () => {
        const warnings = evaluateConflicts(overnight, {
            ...empty,
            otherShifts: [{ shiftId: "s2", start: at("2026-10-03T05:00:00Z"), end: at("2026-10-03T09:00:00Z"), label: "Sat 1a–5a Server" }],
        });
        expect(warnings).toEqual([{ type: "overlap", severity: "block", message: "Already on Sat 1a–5a Server" }]);
        expect(hasBlockingConflict(warnings)).toBe(true);
    });

    test("back-to-back shifts are not an overlap", () => {
        const before = { start: at("2026-10-02T14:00:00Z"), end: at("2026-10-02T22:00:00Z") };
        expect(overlaps(before, overnight)).toBe(false);
        expect(evaluateConflicts(overnight, { ...empty, otherShifts: [{ shiftId: "s0", ...before, label: "Fri 10a–6p" }] })).toEqual([]);
    });

    test("does not compare a shift with itself", () => {
        const warnings = evaluateConflicts(
            { ...overnight, shiftId: "s1" },
            { ...empty, otherShifts: [{ shiftId: "s1", start: overnight.start, end: overnight.end, label: "same" }] },
        );
        expect(warnings).toEqual([]);
    });

    test("approved time off blocks; requested time off and unavailability warn", () => {
        const window = { start: at("2026-10-02T21:00:00Z"), end: at("2026-10-03T03:00:00Z") };
        const approved = evaluateConflicts(overnight, { ...empty, timeOff: [{ ...window, status: "approved", label: "Fri 5p–11p" }] });
        expect(approved).toEqual([{ type: "time_off", severity: "block", message: "On approved time off Fri 5p–11p" }]);

        const pending = evaluateConflicts(overnight, {
            ...empty,
            timeOff: [{ ...window, status: "pending", label: "Fri 5p–11p" }],
            unavailable: [{ ...window, label: "Fri evenings" }],
        });
        expect(pending.map((w) => [w.type, w.severity])).toEqual([
            ["time_off_requested", "warn"],
            ["unavailable", "warn"],
        ]);
        expect(hasBlockingConflict(pending)).toBe(false);
    });

    test("warns about overtime and about a role the person does not hold", () => {
        const warnings = evaluateConflicts(
            { ...overnight, role: "Bartender" },
            { ...empty, personRoles: ["server"], addedOvertimeMinutes: 90 },
        );
        expect(warnings).toEqual([
            { type: "overtime", severity: "warn", message: "Adds 1.5h of overtime" },
            { type: "role_mismatch", severity: "warn", message: "Not set up as Bartender" },
        ]);
        // Role names compare without case.
        expect(evaluateConflicts(overnight, { ...empty, personRoles: ["SERVER"] })).toEqual([]);
    });
});

describe("labels", () => {
    test("formats times the way the grid draws them", () => {
        expect(compactTime("09:00")).toBe("9a");
        expect(compactTime("17:30")).toBe("5:30p");
        expect(compactTime("00:00")).toBe("12a");
        expect(compactTime("12:00")).toBe("12p");
        expect(compactRange("18:00", "02:00")).toBe("6p–2a");
        expect(dayName("2026-09-27")).toBe("Sun");
        expect(compactHours(90)).toBe("1.5h");
        expect(compactHours(480)).toBe("8h");
    });
});
