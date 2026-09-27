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

/** Where a chip came from. */
export type DragSource =
    | { kind: "assignment"; shiftId: string; personId: string }
    | { kind: "open"; shiftId: string };

/** Where it was dropped: a person's day, or the Open row (personId null). */
export interface DropTarget {
    personId: string | null;
    dayIndex: number;
}

export const staying = (shift: SchedulerShift): SchedulerPersonRef[] =>
    shift.assignees.filter((a) => a.pendingState !== "remove").map((a) => ({ personId: a.personId, kind: a.kind }));

const without = (refs: SchedulerPersonRef[], personId: string) => refs.filter((r) => r.personId !== personId);
const firstName = (person: SchedulerPerson | undefined) => person?.name.split(" ")[0] ?? "Someone";
const timeOf = (shift: Pick<SchedulerShift, "startLocal" | "endLocal">) => compactRange(shift.startLocal, shift.endLocal);

/** Taking one person's spot off a shift: a one-person shift goes, a group shift loses the spot. */
function removeSpot(shift: SchedulerShift, personId: string | null): SchedulerChange[] {
    const refs = staying(shift);
    const remaining = personId ? without(refs, personId) : refs;
    if (shift.capacity <= 1 && remaining.length === 0) return [{ op: "delete", shiftId: shift.id }];
    const changes: SchedulerChange[] = [];
    if (personId) changes.push({ op: "assign", shiftId: shift.id, assignees: remaining });
    changes.push({ op: "update", shiftId: shift.id, patch: { capacity: Math.max(1, shift.capacity - 1, remaining.length) } });
    return changes;
}

/** Add a person (or an open spot when ref is null) to the same kind of shift on another day. */
function addToDay(week: SchedulerWeek, shift: SchedulerShift, dayIndex: number, ref: SchedulerPersonRef | null): SchedulerChange[] {
    const localDate = week.days[dayIndex]!.localDate;
    const match = week.shifts.find(
        (s) =>
            s.dayIndex === dayIndex &&
            !s.pendingRemoval &&
            s.role === shift.role &&
            s.startLocal === shift.startLocal &&
            s.endLocal === shift.endLocal &&
            (!ref || !staying(s).some((r) => r.personId === ref.personId)),
    );
    if (match) {
        const refs = staying(match);
        const changes: SchedulerChange[] = [];
        const needsSpot = ref ? refs.length >= match.capacity : true;
        if (needsSpot) changes.push({ op: "update", shiftId: match.id, patch: { capacity: match.capacity + 1 } });
        if (ref) changes.push({ op: "assign", shiftId: match.id, assignees: [...refs, ref] });
        return changes;
    }
    return [
        {
            op: "create",
            shiftId: newShiftId(),
            shift: {
                locationId: shift.locationId,
                localDate,
                startLocal: shift.startLocal,
                endLocal: shift.endLocal,
                role: shift.role,
                capacity: 1,
                breakMinutes: shift.breakMinutes,
                note: shift.note,
            },
            assignees: ref ? [ref] : [],
        },
    ];
}

export function planMove(
    week: SchedulerWeek,
    source: DragSource,
    target: DropTarget,
    options: { copy: boolean },
): Plan | null {
    const shift = week.shifts.find((s) => s.id === source.shiftId);
    if (!shift || shift.pendingRemoval || target.dayIndex < 0 || target.dayIndex > 6) return null;
    const people = new Map(week.people.map((p) => [p.id, p]));
    const refs = staying(shift);
    const sameDay = shift.dayIndex === target.dayIndex;
    const day = weekdayShort(week.days[target.dayIndex]!.localDate);
    const targetPerson = target.personId ? people.get(target.personId) : undefined;
    const targetRef: SchedulerPersonRef | null = targetPerson ? { personId: targetPerson.id, kind: targetPerson.kind } : null;
    if (target.personId && !targetRef) return null;
    const verb = options.copy ? "Copied" : "Moved";

    if (source.kind === "assignment") {
        const mover = people.get(source.personId);
        const personal = shift.capacity === 1 && refs.length === 1 && refs[0]!.personId === source.personId;

        if (!targetRef) {
            // To the Open row: the spot stays, the person comes off it.
            if (sameDay) {
                if (options.copy) return null;
                return {
                    changes: [{ op: "assign", shiftId: shift.id, assignees: without(refs, source.personId) }],
                    label: `Took ${firstName(mover)} off ${timeOf(shift)}`,
                };
            }
            const changes = addToDay(week, shift, target.dayIndex, null);
            if (!options.copy) changes.push(...removeSpot(shift, source.personId));
            return { changes, label: `${verb} an open ${shift.role} spot to ${day}` };
        }

        if (sameDay) {
            if (refs.some((r) => r.personId === targetRef.personId)) return null;
            if (options.copy) {
                const changes: SchedulerChange[] = [];
                if (refs.length >= shift.capacity) changes.push({ op: "update", shiftId: shift.id, patch: { capacity: shift.capacity + 1 } });
                changes.push({ op: "assign", shiftId: shift.id, assignees: [...refs, targetRef] });
                return { changes, label: `Added ${firstName(targetPerson)} to ${timeOf(shift)}` };
            }
            return {
                changes: [{ op: "assign", shiftId: shift.id, assignees: [...without(refs, source.personId), targetRef] }],
                label: `Gave ${firstName(mover)}'s ${timeOf(shift)} to ${firstName(targetPerson)}`,
            };
        }

        if (personal && !options.copy) {
            // A one-person shift moves whole, keeping everything about it.
            const changes: SchedulerChange[] = [
                { op: "update", shiftId: shift.id, patch: { localDate: week.days[target.dayIndex]!.localDate } },
            ];
            if (targetRef.personId !== source.personId) changes.push({ op: "assign", shiftId: shift.id, assignees: [targetRef] });
            return { changes, label: `Moved ${timeOf(shift)} to ${firstName(targetPerson)} on ${day}` };
        }

        const changes = addToDay(week, shift, target.dayIndex, targetRef);
        if (!options.copy) changes.push(...removeSpot(shift, source.personId));
        return { changes, label: `${verb} ${timeOf(shift)} to ${firstName(targetPerson)} on ${day}` };
    }

    // From the Open row.
    if (!targetRef) {
        if (sameDay) return null;
        const changes = addToDay(week, shift, target.dayIndex, null);
        if (!options.copy) changes.push(...removeSpot(shift, null));
        return { changes, label: `${verb} an open ${shift.role} spot to ${day}` };
    }
    if (sameDay) {
        if (refs.some((r) => r.personId === targetRef.personId)) return null;
        return {
            changes: [{ op: "assign", shiftId: shift.id, assignees: [...refs, targetRef] }],
            label: `Gave ${firstName(targetPerson)} ${timeOf(shift)}`,
        };
    }
    const changes = addToDay(week, shift, target.dayIndex, targetRef);
    if (!options.copy) changes.push(...removeSpot(shift, null));
    return { changes, label: `Gave ${firstName(targetPerson)} ${timeOf(shift)} on ${day}` };
}

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
