/**
 * The Add shift panel's form, turned into Scheduler changes. A shift can stand
 * alone (an ordinary café shift) or belong to a named event; naming one at a
 * site on a day that already has it adds the role to that event instead of
 * making a second one.
 */

import type { SchedulerChange, SchedulerPerson, SchedulerPersonRef } from "@repo/contracts/scheduler";
import { compactRange, weekdayShort } from "./format";
import { newEventId, newShiftId, type Plan } from "./plans";
import type { Workspace } from "./workspace";

/** What the panel opens with. Everything is optional: the panel asks for the rest. */
export interface AddShiftPrefill {
    localDate?: string;
    siteId?: string;
    eventName?: string;
    /** Adding a role to this event. */
    eventId?: string | null;
    role?: string;
    person?: SchedulerPerson | null;
    startLocal?: string;
    endLocal?: string;
    capacity?: number;
}

export interface AddShiftInput {
    siteId: string;
    localDate: string;
    /** Blank for an ordinary shift. */
    eventName: string;
    role: string;
    startLocal: string;
    endLocal: string;
    capacity: number;
    assignees: SchedulerPersonRef[];
    /** Adding a role to this event, whatever it is called. */
    eventId?: string | null;
}

/** "Ends the next day": the end is at or before the start. */
export const endsNextDay = (startLocal: string, endLocal: string) => endLocal <= startLocal;

const firstName = (name: string) => name.split(" ")[0] ?? name;

export function planAddShift(ws: Workspace, input: AddShiftInput, people: Pick<SchedulerPerson, "id" | "name">[] = []): Plan {
    const capacity = Math.max(1, input.capacity, input.assignees.length);
    const changes: SchedulerChange[] = [];

    let eventId: string | null = input.eventId ?? null;
    const name = input.eventName.trim();
    if (!eventId && name) {
        const existing = ws.events.find(
            (e) => e.locationId === input.siteId && e.localDate === input.localDate && e.name.trim().toLowerCase() === name.toLowerCase(),
        );
        if (existing) {
            eventId = existing.id;
        } else {
            eventId = newEventId();
            changes.push({
                op: "createEvent",
                eventId,
                event: {
                    locationId: input.siteId,
                    localDate: input.localDate,
                    startLocal: input.startLocal,
                    endLocal: input.endLocal,
                    name,
                },
            });
        }
    }

    changes.push({
        op: "create",
        shiftId: newShiftId(),
        shift: {
            locationId: input.siteId,
            localDate: input.localDate,
            startLocal: input.startLocal,
            endLocal: input.endLocal,
            role: input.role.trim(),
            capacity,
            ...(eventId ? { eventId } : {}),
        },
        assignees: input.assignees,
    });

    const names = input.assignees.map((a) => firstName(people.find((p) => p.id === a.personId)?.name ?? "someone"));
    const when = `${weekdayShort(input.localDate)} ${compactRange(input.startLocal, input.endLocal)}`;
    const open = capacity - input.assignees.length;
    const label =
        names.length === 0
            ? `Added ${capacity} open ${input.role.trim()} ${capacity === 1 ? "position" : "positions"}, ${when}`
            : open > 0
              ? `Added ${input.role.trim()} ${when}: ${names.join(", ")} and ${open} open`
              : `Added ${input.role.trim()} ${when}: ${names.join(", ")}`;
    return { changes, label };
}
