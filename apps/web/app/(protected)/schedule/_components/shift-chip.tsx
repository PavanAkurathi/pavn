"use client";

import { useDraggable } from "@dnd-kit/core";
import type { SchedulerAssignee, SchedulerShift } from "@repo/contracts/scheduler";
import { ShiftCard } from "@repo/ui/components/app/shift-card";
import { roleHue } from "@repo/ui/lib/role-hue";
import { cn } from "@repo/ui/lib/utils";
import { clockRange } from "@/lib/scheduler/format";
import type { DragSource } from "@/lib/scheduler/plans";
import { isBlocking } from "@/lib/scheduler/view-model";

export type Density = "comfortable" | "compact";

export interface ChipActions {
    onOpen: (shiftId: string) => void;
    onRemove: (source: DragSource) => void;
    onCopy: (source: DragSource) => void;
}

/** What a shift is called on the board: the event it belongs to, else its role. */
export function shiftTitle(shift: SchedulerShift, eventName?: string) {
    return eventName ?? shift.role;
}

/**
 * One person's assignment: when it starts and ends first, then what it is and,
 * across several sites, where. How full the whole shift is belongs to the Day
 * plan, not to one worker's entry.
 */
export function ShiftChip({
    shift,
    assignee,
    actions,
    dragId,
    density = "comfortable",
    eventName,
    siteName,
}: {
    shift: SchedulerShift;
    assignee: SchedulerAssignee;
    actions: ChipActions;
    /** Unique per chip on screen. */
    dragId: string;
    density?: Density;
    /** The event this shift belongs to, if any. */
    eventName?: string;
    /** Shown when the board spans more than one site. */
    siteName?: string;
}) {
    const source: DragSource = { kind: "assignment", shiftId: shift.id, personId: assignee.personId };
    const draggable = !shift.pendingRemoval;
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: dragId,
        data: { source, shift },
        disabled: !draggable,
    });

    const draft = shift.status === "draft" || assignee.pendingState === "add";
    const removed = shift.pendingRemoval || assignee.pendingState === "remove";
    const blocking = isBlocking(assignee);
    const softWarnings = assignee.warnings.filter((w) => w.severity === "warn");
    const range = clockRange(shift.startLocal, shift.endLocal);
    const title = shiftTitle(shift, eventName);

    const label = [
        title,
        `${range}${shift.overnight ? ", ends the next day" : ""}`,
        siteName,
        draft ? "draft" : null,
        removed ? "being removed" : null,
        blocking ? "has a conflict" : null,
    ]
        .filter(Boolean)
        .join(", ");

    return (
        <ShiftCard
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            // dnd-kit's role/description are for keyboard dragging, which this grid does with c and v instead.
            role="button"
            aria-roledescription={undefined}
            aria-describedby={undefined}
            aria-label={label}
            tooltip={[label, ...softWarnings.map((w) => w.message)].join("\n")}
            data-chip
            onClick={(event) => {
                event.stopPropagation();
                actions.onOpen(shift.id);
            }}
            onKeyDown={(event) => {
                if (shift.pendingRemoval) return;
                if (event.key === "Delete" || event.key === "Backspace") {
                    event.preventDefault();
                    event.stopPropagation();
                    actions.onRemove(source);
                } else if (event.key === "c" && !event.metaKey && !event.ctrlKey) {
                    event.stopPropagation();
                    actions.onCopy(source);
                }
            }}
            leadWith="time"
            time={range}
            overnight={shift.overnight}
            title={title}
            subtitle={eventName ? shift.role : undefined}
            hue={roleHue(shift.role)}
            site={siteName}
            draft={draft}
            removed={removed}
            conflict={blocking}
            edited={shift.hasUnpublishedEdits}
            event={Boolean(shift.eventId)}
            density={density}
            className={cn(draggable && "cursor-grab active:cursor-grabbing", isDragging && "opacity-40")}
        />
    );
}

/** What follows the pointer while dragging. */
export function ChipGhost({ shift, copy }: { shift: SchedulerShift; copy: boolean }) {
    return (
        <div className="relative w-40">
            <ShiftCard tabIndex={-1} leadWith="time" title={shift.role} hue={roleHue(shift.role)} time={clockRange(shift.startLocal, shift.endLocal)} overnight={shift.overnight} className="shadow-lg" />
            {copy ? (
                <span className="absolute -right-1 -top-2 rounded bg-foreground px-1 text-[10px] font-bold text-background">+ copy</span>
            ) : null}
        </div>
    );
}
