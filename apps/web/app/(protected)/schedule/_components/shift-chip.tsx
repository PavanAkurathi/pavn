"use client";

import { useDraggable } from "@dnd-kit/core";
import type { SchedulerAssignee, SchedulerShift } from "@repo/contracts/scheduler";
import { ShiftCard } from "@repo/ui/components/app/shift-card";
import { cn } from "@repo/ui/lib/utils";
import { compactRange } from "@/lib/scheduler/format";
import type { DragSource } from "@/lib/scheduler/plans";
import { isBlocking } from "@/lib/scheduler/view-model";

export type Density = "comfortable" | "compact";

type ChipVariant =
    /** On a person's row: this person's assignment. */
    | { kind: "assignment"; assignee: SchedulerAssignee }
    /** On the Open row: the slots nobody has yet. */
    | { kind: "open" }
    /** On a role row: the shift itself, with how full it is. */
    | { kind: "shift" };

export interface ChipActions {
    onOpen: (shiftId: string) => void;
    onRemove: (source: DragSource) => void;
    onCopy: (source: DragSource) => void;
}

/** What a shift is called on the board: the event it belongs to, else its role. */
export function shiftTitle(shift: SchedulerShift, eventName?: string) {
    return eventName ?? shift.role;
}

export function ShiftChip({
    shift,
    variant,
    actions,
    dragId,
    density = "comfortable",
    eventName,
}: {
    shift: SchedulerShift;
    variant: ChipVariant;
    actions: ChipActions;
    /** Unique per chip on screen; chips on the role rows aren't dragged. */
    dragId?: string;
    density?: Density;
    /** The event this shift belongs to, if any. */
    eventName?: string;
}) {
    const source: DragSource | null =
        variant.kind === "assignment"
            ? { kind: "assignment", shiftId: shift.id, personId: variant.assignee.personId }
            : variant.kind === "open"
                ? { kind: "open", shiftId: shift.id }
                : null;
    const draggable = Boolean(dragId && source && !shift.pendingRemoval);
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: dragId ?? `static:${shift.id}`,
        data: { source, shift, variant },
        disabled: !draggable,
    });

    const assignee = variant.kind === "assignment" ? variant.assignee : null;
    const draft = shift.status === "draft" || assignee?.pendingState === "add";
    const removed = shift.pendingRemoval || assignee?.pendingState === "remove";
    const assignees = assignee ? [assignee] : variant.kind === "shift" ? shift.assignees : [];
    const blocking = assignees.some(isBlocking);
    const softWarnings = assignees.flatMap((a) => a.warnings.filter((w) => w.severity === "warn"));
    const range = compactRange(shift.startLocal, shift.endLocal);
    const open = variant.kind === "open";
    const fill = `${shift.filled}/${shift.capacity}`;
    const title = shiftTitle(shift, eventName);

    const label = [
        title,
        range,
        open ? `${shift.open} open` : `${shift.filled} of ${shift.capacity} filled`,
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
            data-open={shift.open > 0 && !shift.pendingRemoval ? "true" : undefined}
            onClick={(event) => {
                event.stopPropagation();
                actions.onOpen(shift.id);
            }}
            onKeyDown={(event) => {
                if (!source || shift.pendingRemoval) return;
                if (event.key === "Delete" || event.key === "Backspace") {
                    event.preventDefault();
                    event.stopPropagation();
                    actions.onRemove(source);
                } else if (event.key === "c" && !event.metaKey && !event.ctrlKey) {
                    event.stopPropagation();
                    actions.onCopy(source);
                }
            }}
            kind={open ? "open" : "assigned"}
            title={open ? undefined : title}
            time={range}
            detail={open ? shift.role : fill}
            draft={draft}
            removed={removed}
            conflict={blocking}
            edited={shift.hasUnpublishedEdits}
            event={Boolean(shift.eventId)}
            density={density}
            openLabel={`OPEN · ${shift.open > 1 ? `${shift.open} to fill` : "tap to assign"}`}
            className={cn(draggable && "cursor-grab active:cursor-grabbing", isDragging && "opacity-40")}
        />
    );
}

/** What follows the pointer while dragging. */
export function ChipGhost({ shift, copy }: { shift: SchedulerShift; copy: boolean }) {
    return (
        <div className="relative w-40">
            <ShiftCard tabIndex={-1} title={shift.role} time={compactRange(shift.startLocal, shift.endLocal)} className="shadow-lg" />
            {copy ? (
                <span className="absolute -right-1 -top-2 rounded bg-foreground px-1 text-[10px] font-bold text-background">+ copy</span>
            ) : null}
        </div>
    );
}
