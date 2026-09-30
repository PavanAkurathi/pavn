import { describe, expect, test } from "bun:test";
import { NAV_ITEMS, isNavActive } from "./nav-items";

const item = (key: string) => NAV_ITEMS.find((i) => i.key === key)!;

describe("isNavActive", () => {
    test("lights the item for its own page and anything under it", () => {
        expect(isNavActive(item("schedule"), "/schedule")).toBe(true);
        expect(isNavActive(item("schedule"), "/schedule/anything")).toBe(true);
        expect(isNavActive(item("reports"), "/reports")).toBe(true);
    });

    test("keeps a timesheet under Shifts and a worker profile under Roster", () => {
        expect(isNavActive(item("shifts"), "/dashboard/shifts")).toBe(true);
        expect(isNavActive(item("shifts"), "/dashboard/shifts/shf_1/timesheet")).toBe(true);
        expect(isNavActive(item("roster"), "/rosters/import")).toBe(true);
        expect(isNavActive(item("roster"), "/workers/abc")).toBe(true);
    });

    test("does not confuse similar prefixes or other pages", () => {
        expect(isNavActive(item("schedule"), "/schedules-old")).toBe(false);
        expect(isNavActive(item("roster"), "/rosters-archive")).toBe(false);
        expect(isNavActive(item("schedule"), "/settings")).toBe(false);
        for (const nav of NAV_ITEMS) expect(isNavActive(nav, "/settings/billing")).toBe(false);
    });
});
