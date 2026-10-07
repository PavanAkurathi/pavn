import { describe, expect, test } from "bun:test";
import { defaultShiftDate, endsNextDay, planAddShift } from "./add-shift";
import type { Workspace } from "./workspace";

const ws = (events: Workspace["events"] = []): Workspace => ({
    week: { location: { id: "gsu", name: "George Sherman Union", timezone: "America/New_York" } } as Workspace["week"],
    events,
    sites: [{ id: "gsu", name: "George Sherman Union" }],
    weeks: [],
});

const base = { siteId: "gsu", localDate: "2026-10-16", eventName: "", role: "Server", startLocal: "16:30", endLocal: "22:00", capacity: 6, assignees: [] };

describe("planAddShift", () => {
    test("an ordinary shift needs no event", () => {
        const plan = planAddShift(ws(), base);
        expect(plan.changes.map((c) => c.op)).toEqual(["create"]);
        expect(plan.changes[0]).toMatchObject({ shift: { locationId: "gsu", localDate: "2026-10-16", role: "Server", capacity: 6 } });
        expect((plan.changes[0] as { shift: Record<string, unknown> }).shift.eventId).toBeUndefined();
        expect(plan.label).toBe("Added 6 open Server positions, Fri 4:30p–10p");
    });

    test("a named event is created once, with the shift in it", () => {
        const plan = planAddShift(ws(), { ...base, eventName: "Alumni reception" });
        expect(plan.changes.map((c) => c.op)).toEqual(["createEvent", "create"]);
        const [event, shift] = plan.changes as unknown as [{ eventId: string; event: { name: string; locationId: string } }, { shift: { eventId: string } }];
        expect(event.event).toMatchObject({ name: "Alumni reception", locationId: "gsu" });
        expect(shift.shift.eventId).toBe(event.eventId);
    });

    test("naming an event that is already there adds a role to it", () => {
        const existing = [{ id: "evt_x", locationId: "gsu", localDate: "2026-10-16", name: "Alumni Reception" }] as Workspace["events"];
        const plan = planAddShift(ws(existing), { ...base, eventName: "alumni reception", role: "Prep", startLocal: "14:00" });
        expect(plan.changes.map((c) => c.op)).toEqual(["create"]);
        expect((plan.changes[0] as { shift: { eventId: string } }).shift.eventId).toBe("evt_x");
    });

    test("the same name at another site is a different event", () => {
        const existing = [{ id: "evt_x", locationId: "charles", localDate: "2026-10-16", name: "Alumni reception" }] as Workspace["events"];
        const plan = planAddShift(ws(existing), { ...base, eventName: "Alumni reception" });
        expect(plan.changes.map((c) => c.op)).toEqual(["createEvent", "create"]);
    });

    test("assigned people count toward the positions, and the rest stay open", () => {
        const people = [
            { id: "ana", name: "Ana Ruiz" },
            { id: "ben", name: "Ben Kim" },
        ];
        const plan = planAddShift(
            ws(),
            { ...base, capacity: 1, assignees: [{ personId: "ana" }, { personId: "ben" }] },
            people,
        );
        expect((plan.changes[0] as { shift: { capacity: number } }).shift.capacity).toBe(2);
        expect(plan.label).toBe("Added Server Fri 4:30p–10p: Ana, Ben");

        const some = planAddShift(ws(), { ...base, assignees: [{ personId: "ana" }] }, people);
        expect(some.label).toBe("Added Server Fri 4:30p–10p: Ana and 5 open");
    });

    test("an end at or before the start means the next day", () => {
        expect(endsNextDay("21:00", "02:00")).toBe(true);
        expect(endsNextDay("09:00", "17:00")).toBe(false);
        expect(endsNextDay("09:00", "09:00")).toBe(true);
    });
});

describe("defaultShiftDate", () => {
    const tz = "America/New_York";

    test("opens on today while the default window is still ahead", () => {
        const elevenAm = Date.parse("2026-10-05T15:00:00Z");
        expect(defaultShiftDate("2026-10-05", "2026-10-04", tz, elevenAm)).toBe("2026-10-05");
    });

    test("opens on tomorrow once today's default window is over, in the site's own time", () => {
        const sixPm = Date.parse("2026-10-05T22:00:00Z");
        expect(defaultShiftDate("2026-10-05", "2026-10-04", tz, sixPm)).toBe("2026-10-06");
    });

    test("a week that doesn't contain today opens on its first day", () => {
        expect(defaultShiftDate(undefined, "2026-10-11", tz, Date.parse("2026-10-05T22:00:00Z"))).toBe("2026-10-11");
    });
});
