import { describe, expect, test } from "bun:test";
import { addDays, clockRange, hoursLabel, longDate, shortDate, weekRangeFull } from "./format";

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
