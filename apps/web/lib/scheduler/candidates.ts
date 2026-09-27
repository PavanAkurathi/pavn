/**
 * "Who can take it": everyone who could work a shift, best first, each with
 * the reason they might not be the right call. The same rules the server
 * enforces, read off the week already on screen.
 */

import type { SchedulerPerson, SchedulerShift, SchedulerWeek } from "@repo/contracts/scheduler";
import { compactRange, formatHours, weekdayShort } from "./format";
import { staying } from "./plans";

export interface Candidate {
    person: SchedulerPerson;
    /** Double-booked or on approved time off: needs "Schedule anyway". */
    blocked: boolean;
    reasons: string[];
    trained: boolean;
}

const overlaps = (a: { startsAt: string; endsAt: string }, b: { startsAt: string; endsAt: string }) =>
    Date.parse(a.startsAt) < Date.parse(b.endsAt) && Date.parse(b.startsAt) < Date.parse(a.endsAt);

/** One person against a shift as it would be on another day: the drop hint while dragging. */
export function checkPerson(
    week: SchedulerWeek,
    shift: SchedulerShift,
    personId: string,
    dayIndex: number,
): { blocked: boolean; reasons: string[] } {
    const person = week.people.find((p) => p.id === personId);
    if (!person) return { blocked: false, reasons: [] };
    const shiftMs = (dayIndex - shift.dayIndex) * 24 * 60 * 60 * 1000;
    const moved = {
        ...shift,
        dayIndex,
        startsAt: new Date(Date.parse(shift.startsAt) + shiftMs).toISOString(),
        endsAt: new Date(Date.parse(shift.endsAt) + shiftMs).toISOString(),
    };
    const { blocked, reasons } = assess(week, person, moved);
    return { blocked, reasons };
}

function assess(week: SchedulerWeek, person: SchedulerPerson, shift: SchedulerShift): Candidate {
    const role = shift.role.toLowerCase();
    const reasons: string[] = [];
    let blocked = false;

    for (const other of week.shifts) {
        if (other.id === shift.id || other.pendingRemoval) continue;
        if (!staying(other).some((r) => r.personId === person.id)) continue;
        if (overlaps(other, shift)) {
            blocked = true;
            reasons.push(`Already on ${weekdayShort(other.localDate)} ${compactRange(other.startLocal, other.endLocal)}`);
        }
    }
    for (const off of week.timeOff) {
        if (off.personId !== person.id || !overlaps(off, shift)) continue;
        if (off.status === "approved") {
            blocked = true;
            reasons.push("On time off");
        } else {
            reasons.push("Asked for time off");
        }
    }
    if (week.unavailable.some((u) => u.personId === person.id && overlaps(u, shift))) reasons.push("Said they're unavailable");

    const alreadyOn = staying(shift).some((r) => r.personId === person.id);
    const after = person.scheduledMinutes + (alreadyOn ? 0 : shift.paidMinutes);
    if (week.settings.overtimePolicy === "weekly_40" && after > 40 * 60) reasons.push(`Would be at ${formatHours(after)}`);

    const trained = person.roles.some((r) => r.toLowerCase() === role);
    if (!trained) reasons.push(`Not set up as ${shift.role}`);

    return { person, blocked, reasons, trained };
}

export function rankCandidates(week: SchedulerWeek, shift: SchedulerShift): Candidate[] {
    const onShift = new Set(staying(shift).map((r) => r.personId));
    const candidates = week.people.filter((person) => !onShift.has(person.id)).map((person) => assess(week, person, shift));

    return candidates.sort(
        (a, b) =>
            Number(a.blocked) - Number(b.blocked) ||
            Number(b.trained) - Number(a.trained) ||
            a.reasons.length - b.reasons.length ||
            a.person.scheduledMinutes - b.person.scheduledMinutes ||
            a.person.name.localeCompare(b.person.name),
    );
}
