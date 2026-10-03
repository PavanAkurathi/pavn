"use client";

import { useDraggable } from "@dnd-kit/core";
import type { SchedulerAssignee, SchedulerPerson, SchedulerShift } from "@repo/contracts/scheduler";
import { ShiftCard } from "@repo/ui/components/app/shift-card";
import { roleHue } from "@repo/ui/lib/role-hue";
import { cn } from "@repo/ui/lib/utils";
import { compactRange } from "@/lib/scheduler/format";
import type { DragSource } from "@/lib/scheduler/plans";
import { isBlocking } from "@/lib/scheduler/view-model";

export type Density = "comfortable" | "compact";

type ChipVariant =
    /** On a person's row: this person's assignment. */
    | { kind: "assignment"; assignee: SchedulerAssignee; showRole: boolean }
    /** On the Open row: the slots nobody has yet. */
    | { kind: "open" }
    /** On a position row: one person on the shift, with their name. */
    | { kind: "person"; assignee: SchedulerAssignee; person: SchedulerPerson | undefined }
    /** On a position row: the slots on that shift nobody has yet. */
    | { kind: "open-slots" };

export interface ChipActions {
    onOpen: (shiftId: string) => void;
    onRemove: (source: DragSource) => void;
    onCopy: (source: DragSource) => void;
}

export function ShiftChip({
    shift,
    variant,
    actions,
    dragId,
    density = "comfortable",
}: {
    shift: SchedulerShift;
    variant: ChipVariant;
    actions: ChipActions;
    /** Unique per chip on screen; chips on the Positions view aren't dragged. */
    dragId?: string;
    density?: Density;
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

    const assignee = variant.kind === "assignment" || variant.kind === "person" ? variant.assignee : null;
    const draft = shift.status === "draft" || assignee?.pendingState === "add";
    const removed = shift.pendingRemoval || assignee?.pendingState === "remove";
    const blocking = assignee ? isBlocking(assignee) : false;
    const softWarnings = assignee ? assignee.warnings.filter((w) => w.severity === "warn") : [];
    const range = compactRange(shift.startLocal, shift.endLocal);
    const open = variant.kind === "open" || variant.kind === "open-slots";
    const who = variant.kind === "person" ? (variant.person?.name ?? "Someone") : undefined;

    const label = [
        who,
        range,
        shift.role,
        open ? `${shift.open} open` : null,
        draft ? "draft" : null,
        removed ? "being removed" : null,
        blocking ? "has a conflict" : null,
    ]
        .filter(Boolean)
        .join(", ");

    // What follows the time: the role where the row doesn't already say it, and whether staff can see it yet.
    const detail = [
        variant.kind === "open" || (variant.kind === "assignment" && variant.showRole) ? shift.role : null,
        draft ? "draft" : null,
    ]
        .filter(Boolean)
        .join(" · ");

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
            title={[label, ...softWarnings.map((w) => w.message)].join("\n")}
            data-chip
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
            hue={roleHue(shift.role)}
            kind={open ? "open" : "assigned"}
            name={who}
            time={range}
            detail={detail || undefined}
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
            <ShiftCard
                tabIndex={-1}
                hue={roleHue(shift.role)}
                time={compactRange(shift.startLocal, shift.endLocal)}
                detail={shift.role}
                className="shadow-lg"
            />
            {copy ? (
                <span className="absolute -right-1 -top-2 rounded bg-foreground px-1 text-[10px] font-bold text-background">+ copy</span>
            ) : null}
        </div>
    );
}
