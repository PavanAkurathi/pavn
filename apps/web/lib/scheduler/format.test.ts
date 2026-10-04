import { describe, expect, test } from "bun:test";
import { addDays, longDate, shortDate } from "./format";

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
