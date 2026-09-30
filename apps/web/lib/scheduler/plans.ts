/**
 * Grid gestures turned into Scheduler changes. The server applies a plan as
 * one batch and hands back its undo, so these stay pure and small: the week
 * in, the changes out.
 */

import type {
    SchedulerChange,
    SchedulerPerson,
    SchedulerPersonRef,
    SchedulerShift,
    SchedulerWeek,
} from "@repo/contracts/scheduler";
import { compactRange, weekdayShort } from "./format";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Same shape the server's ids use: shf_ and 16 characters. */
export function newShiftId(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return `shf_${Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("")}`;
}

export interface Plan {
    changes: SchedulerChange[];
    /** What happened, for the undo toast: "Moved Ana to Tue". */
    label: string;
}

/** Which chip a change is about: one person's place on a shift, or the open spots on it. */
export type DragSource =
    | { kind: "assignment"; shiftId: string; personId: string }
    | { kind: "open"; shiftId: string };

export const staying = (shift: SchedulerShift): SchedulerPersonRef[] =>
    shift.assignees.filter((a) => a.pendingState !== "remove").map((a) => ({ personId: a.personId, kind: a.kind }));

const without = (refs: SchedulerPersonRef[], personId: string) => refs.filter((r) => r.personId !== personId);
const firstName = (person: SchedulerPerson | undefined) => person?.name.split(" ")[0] ?? "Someone";
const timeOf = (shift: Pick<SchedulerShift, "startLocal" | "endLocal">) => compactRange(shift.startLocal, shift.endLocal);

/** Delete on a person's chip takes them off; on an open chip it drops the open spots. */
export function planRemove(week: SchedulerWeek, source: DragSource): Plan | null {
    const shift = week.shifts.find((s) => s.id === source.shiftId);
    if (!shift || shift.pendingRemoval) return null;
    const refs = staying(shift);
    if (source.kind === "assignment") {
        const person = week.people.find((p) => p.id === source.personId);
        if (shift.capacity === 1 && refs.length === 1) {
            return { changes: [{ op: "delete", shiftId: shift.id }], label: `Deleted ${firstName(person)}'s ${timeOf(shift)}` };
        }
        return {
            changes: [{ op: "assign", shiftId: shift.id, assignees: without(refs, source.personId) }],
            label: `Took ${firstName(person)} off ${timeOf(shift)}`,
        };
    }
    if (refs.length === 0) return { changes: [{ op: "delete", shiftId: shift.id }], label: `Deleted ${timeOf(shift)} ${shift.role}` };
    return {
        changes: [{ op: "update", shiftId: shift.id, patch: { capacity: refs.length } }],
        label: `Dropped ${shift.open} open ${shift.role} ${shift.open === 1 ? "spot" : "spots"}`,
    };
}

const shiftLabel = (week: SchedulerWeek, shift: SchedulerShift) =>
    `${weekdayShort(week.days[shift.dayIndex]?.localDate ?? shift.localDate)} ${timeOf(shift)}`;

/** Someone joins a shift. A full shift grows by one spot, so adding never fails on headcount. */
export function planAddPerson(week: SchedulerWeek, shiftId: string, person: SchedulerPerson): Plan | null {
    const shift = week.shifts.find((s) => s.id === shiftId);
    if (!shift || shift.pendingRemoval) return null;
    const refs = staying(shift);
    if (refs.some((r) => r.personId === person.id)) return null;
    const changes: SchedulerChange[] = [];
    if (refs.length >= shift.capacity) changes.push({ op: "update", shiftId, patch: { capacity: refs.length + 1 } });
    changes.push({ op: "assign", shiftId, assignees: [...refs, { personId: person.id, kind: person.kind }] });
    return { changes, label: `Added ${firstName(person)} to ${shiftLabel(week, shift)}` };
}

/** Someone comes off a shift; the spot stays open so it shows up as needed. */
export function planTakeOff(week: SchedulerWeek, shiftId: string, personId: string): Plan | null {
    const shift = week.shifts.find((s) => s.id === shiftId);
    if (!shift || shift.pendingRemoval) return null;
    const refs = staying(shift);
    if (!refs.some((r) => r.personId === personId)) return null;
    const person = week.people.find((p) => p.id === personId);
    return {
        changes: [{ op: "assign", shiftId, assignees: without(refs, personId) }],
        label: `Took ${firstName(person)} off ${shiftLabel(week, shift)}`,
    };
}

/** "How many people": never below the people already on it, never below one. */
export function planSetNeeded(week: SchedulerWeek, shiftId: string, wanted: number): Plan | null {
    const shift = week.shifts.find((s) => s.id === shiftId);
    if (!shift || shift.pendingRemoval) return null;
    const capacity = Math.min(200, Math.max(1, wanted, staying(shift).length));
    if (capacity === shift.capacity) return null;
    return {
        changes: [{ op: "update", shiftId, patch: { capacity } }],
        label: `Now need ${capacity} ${shift.role} ${weekdayShort(week.days[shift.dayIndex]?.localDate ?? shift.localDate)} ${timeOf(shift)}`,
    };
}

/**
 * "Copy to other days": the same shift on the chosen days, one new shift each,
 * in a single undoable step. With `keepPeople` the same people come along
 * (skipping days they already work it); without, each copy is open.
 */
export function planCopyToDays(
    week: SchedulerWeek,
    shiftId: string,
    dayIndexes: number[],
    options: { keepPeople: boolean },
): Plan | null {
    const shift = week.shifts.find((s) => s.id === shiftId);
    if (!shift || shift.pendingRemoval) return null;
    const people = options.keepPeople ? staying(shift) : [];
    const changes: SchedulerChange[] = [];
    const days: number[] = [];
    for (const dayIndex of [...new Set(dayIndexes)].sort((a, b) => a - b)) {
        if (dayIndex === shift.dayIndex || dayIndex < 0 || dayIndex > 6) continue;
        const alreadyThere =
            people.length > 0 &&
            week.shifts.some(
                (s) =>
                    s.dayIndex === dayIndex &&
                    !s.pendingRemoval &&
                    s.role === shift.role &&
                    s.startLocal === shift.startLocal &&
                    s.endLocal === shift.endLocal &&
                    staying(s).some((r) => people.some((p) => p.personId === r.personId)),
            );
        if (alreadyThere) continue;
        changes.push({
            op: "create",
            shiftId: newShiftId(),
            shift: {
                locationId: shift.locationId,
                localDate: week.days[dayIndex]!.localDate,
                startLocal: shift.startLocal,
                endLocal: shift.endLocal,
                role: shift.role,
                capacity: Math.max(shift.capacity, people.length),
                breakMinutes: shift.breakMinutes,
                note: shift.note,
            },
            assignees: people,
        });
        days.push(dayIndex);
    }
    if (changes.length === 0) return null;
    const names = days.map((d) => weekdayShort(week.days[d]!.localDate)).join(", ");
    return { changes, label: `Copied ${timeOf(shift)} ${shift.role} to ${names}` };
}

export function planCreate(input: {
    week: SchedulerWeek;
    dayIndex: number;
    person: SchedulerPerson | null;
    startLocal: string;
    endLocal: string;
    role: string;
    capacity?: number;
}): Plan {
    const { week, dayIndex, person } = input;
    const capacity = Math.max(1, input.capacity ?? 1);
    return {
        changes: [
            {
                op: "create",
                shiftId: newShiftId(),
                shift: {
                    locationId: week.location.id,
                    localDate: week.days[dayIndex]!.localDate,
                    startLocal: input.startLocal,
                    endLocal: input.endLocal,
                    role: input.role,
                    capacity,
                },
                assignees: person ? [{ personId: person.id, kind: person.kind }] : [],
            },
        ],
        label: person
            ? `Added ${compactRange(input.startLocal, input.endLocal)} for ${firstName(person)}`
            : `Added ${capacity} open ${input.role} ${capacity === 1 ? "spot" : "spots"}`,
    };
}

/** Last week's shifts, a week later, as new drafts: with the same people or as open spots. */
export function planCopyWeek(from: SchedulerWeek, to: SchedulerWeek, keepPeople: boolean): Plan {
    const changes: SchedulerChange[] = from.shifts
        .filter((s) => !s.pendingRemoval)
        .map((s) => ({
            op: "create" as const,
            shiftId: newShiftId(),
            shift: {
                locationId: to.location.id,
                localDate: to.days[s.dayIndex]!.localDate,
                startLocal: s.startLocal,
                endLocal: s.endLocal,
                role: s.role,
                capacity: s.capacity,
                breakMinutes: s.breakMinutes,
                note: s.note,
            },
            assignees: keepPeople ? staying(s) : [],
        }));
    return { changes, label: `Copied ${changes.length} ${changes.length === 1 ? "shift" : "shifts"} from last week` };
}

export function planTemplate(
    week: SchedulerWeek,
    template: { name: string; startTime: string; endTime: string; positions: { roleName: string; headcount: number }[] },
    dayIndexes: number[],
): Plan {
    const changes: SchedulerChange[] = dayIndexes.flatMap((dayIndex) =>
        template.positions.map((p) => ({
            op: "create" as const,
            shiftId: newShiftId(),
            shift: {
                locationId: week.location.id,
                localDate: week.days[dayIndex]!.localDate,
                startLocal: template.startTime,
                endLocal: template.endTime,
                role: p.roleName,
                capacity: p.headcount,
            },
            assignees: [],
        })),
    );
    return { changes, label: `Added ${template.name} on ${dayIndexes.length} ${dayIndexes.length === 1 ? "day" : "days"}` };
}

/** Takes people with blocking conflicts off a plan's new shifts, leaving their spots open. */
export function withoutPeople(changes: SchedulerChange[], drop: { shiftId: string; personId: string }[]): SchedulerChange[] {
    const dropped = new Set(drop.map((d) => `${d.shiftId}:${d.personId}`));
    return changes.map((c) =>
        c.op === "create" || c.op === "assign"
            ? { ...c, assignees: (c.assignees ?? []).filter((a) => !dropped.has(`${c.shiftId}:${a.personId}`)) }
            : c,
    );
}

// ---- Events -----------------------------------------------------------------------

export function newEventId(): string {
    return newShiftId().replace(/^shf_/, "evt_");
}

export interface EventDraft {
    name: string;
    dayIndex: number;
    startLocal: string;
    endLocal: string;
    notes: string | null;
}

/** An event and one open shift per role it needs, in one step. */
export function planCreateEvent(week: SchedulerWeek, draft: EventDraft, roles: { role: string; count: number }[]): Plan {
    const eventId = newEventId();
    const localDate = week.days[draft.dayIndex]!.localDate;
    return {
        changes: [
            {
                op: "createEvent",
                eventId,
                event: { locationId: week.location.id, localDate, startLocal: draft.startLocal, endLocal: draft.endLocal, name: draft.name, notes: draft.notes },
            },
            ...roles
                .filter((r) => r.role.trim() && r.count > 0)
                .map((r) => ({
                    op: "create" as const,
                    shiftId: newShiftId(),
                    shift: {
                        locationId: week.location.id,
                        localDate,
                        startLocal: draft.startLocal,
                        endLocal: draft.endLocal,
                        role: r.role.trim(),
                        capacity: r.count,
                        eventId,
                    },
                    assignees: [],
                })),
        ],
        label: `Added ${draft.name}`,
    };
}

/** Moving an event moves its shifts: all of them to the new day, and those that kept the event's hours to the new hours. */
export function planUpdateEvent(week: SchedulerWeek, eventId: string, next: EventDraft): Plan | null {
    const event = week.events.find((e) => e.id === eventId);
    if (!event) return null;
    const localDate = week.days[next.dayIndex]!.localDate;
    const patch: Record<string, string | null> = {};
    if (next.name !== event.name) patch.name = next.name;
    if ((next.notes ?? null) !== (event.notes ?? null)) patch.notes = next.notes;
    if (localDate !== event.localDate) patch.localDate = localDate;
    if (next.startLocal !== event.startLocal) patch.startLocal = next.startLocal;
    if (next.endLocal !== event.endLocal) patch.endLocal = next.endLocal;
    if (Object.keys(patch).length === 0) return null;

    const changes: SchedulerChange[] = [{ op: "updateEvent", eventId, patch }];
    for (const s of week.shifts.filter((s) => s.eventId === eventId && !s.pendingRemoval)) {
        const shiftPatch: Record<string, string> = {};
        if (patch.localDate) shiftPatch.localDate = localDate;
        if (s.startLocal === event.startLocal && s.endLocal === event.endLocal) {
            if (patch.startLocal) shiftPatch.startLocal = next.startLocal;
            if (patch.endLocal) shiftPatch.endLocal = next.endLocal;
        }
        if (Object.keys(shiftPatch).length) changes.push({ op: "update", shiftId: s.id, patch: shiftPatch });
    }
    return { changes, label: `Changed ${next.name}` };
}

export function planDeleteEvent(week: SchedulerWeek, eventId: string, withShifts: boolean): Plan | null {
    const event = week.events.find((e) => e.id === eventId);
    if (!event) return null;
    const shifts = withShifts ? week.shifts.filter((s) => s.eventId === eventId && !s.pendingRemoval) : [];
    return {
        changes: [...shifts.map((s) => ({ op: "delete" as const, shiftId: s.id })), { op: "deleteEvent", eventId }],
        label: withShifts ? `Deleted ${event.name} and its shifts` : `Deleted ${event.name}`,
    };
}
