import { describe, expect, test } from "bun:test";
import { addDays, addMonths, clockRange, hoursLabel, longDate, monthGrid, monthLabel, sameMonth, shortDate, weekRangeFull } from "./format";

describe("dates in words", () => {
  test("the planning week reads with the right weekdays", () => {
    expect(longDate("2026-10-16")).toBe("Friday, October 16");
    expect(shortDate("2026-10-11")).toBe("Sun, Oct 11");
    expect(shortDate("2026-10-17")).toBe("Sat, Oct 17");
  });

  test("moving a day crosses months", () => {
    expect(shortDate(addDays("2026-10-31", 1))).toBe("Sun, Nov 1");
  });
});

describe("how a shift reads", () => {
  test("hours as people say them", () => {
    expect(clockRange("11:00", "16:00")).toBe("11am–4pm");
    expect(clockRange("17:00", "23:00")).toBe("5–11pm");
    expect(clockRange("16:30", "22:00", { spaced: true })).toBe("4:30 – 10pm");
    expect(clockRange("21:00", "02:00")).toBe("9pm–2am");
    expect(clockRange("00:00", "08:00")).toBe("12–8am");
  });

  test("the week, with its year", () => {
    expect(weekRangeFull("2026-10-11", "2026-10-17")).toBe("Oct 11 – 17, 2026");
    expect(weekRangeFull("2026-10-25", "2026-10-31")).toBe("Oct 25 – 31, 2026");
    expect(weekRangeFull("2026-10-28", "2026-11-03")).toBe("Oct 28 – Nov 3, 2026");
    expect(weekRangeFull("2026-12-27", "2027-01-02")).toBe("Dec 27, 2026 – Jan 2, 2027");
  });

  test("a worker's hours", () => {
    expect(hoursLabel(1200)).toBe("20 hrs");
    expect(hoursLabel(1230)).toBe("20.5 hrs");
    expect(hoursLabel(60)).toBe("1 hr");
    expect(hoursLabel(0)).toBe("0 hrs");
  });
});

describe("month calendar helpers", () => {
    test("monthLabel names the month and year", () => {
        expect(monthLabel("2026-10-07")).toBe("October 2026");
    });

    test("addMonths lands on the 1st, even from the 31st", () => {
        expect(addMonths("2026-10-07", 1)).toBe("2026-11-01");
        expect(addMonths("2026-01-31", 1)).toBe("2026-02-01");
        expect(addMonths("2026-01-15", -1)).toBe("2025-12-01");
    });

    test("sameMonth compares the calendar month", () => {
        expect(sameMonth("2026-10-01", "2026-10-31")).toBe(true);
        expect(sameMonth("2026-10-31", "2026-11-01")).toBe(false);
    });

    test("monthGrid covers whole weeks around the month, Sunday first", () => {
        const days = monthGrid("2026-10-15", 0);
        // October 2026 starts on a Thursday and ends on a Saturday.
        expect(days[0]).toBe("2026-09-27");
        expect(days.at(-1)).toBe("2026-10-31");
        expect(days.length).toBe(35);
    });

    test("monthGrid honours a Monday week start", () => {
        const days = monthGrid("2026-10-15", 1);
        expect(days[0]).toBe("2026-09-28");
        expect(days.at(-1)).toBe("2026-11-01");
        expect(days.length % 7).toBe(0);
    });
});
