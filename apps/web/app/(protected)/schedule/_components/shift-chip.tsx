"use client";

import type { SchedulerAssignee, SchedulerShift } from "@repo/contracts/scheduler";
import { cn } from "@repo/ui/lib/utils";
import { compactRange } from "@/lib/scheduler/format";
import { roleColor } from "@/lib/scheduler/role-color";
import type { DragSource } from "@/lib/scheduler/plans";
import { isBlocking } from "@/lib/scheduler/view-model";
import styles from "./scheduler.module.css";

type ChipVariant =
    /** On a person's row: this person's assignment. */
    | { kind: "assignment"; assignee: SchedulerAssignee; showRole: boolean }
    /** On the Open row: the slots nobody has yet. */
    | { kind: "open" }
    /** On a position row: the whole shift with its fill. */
    | { kind: "position" };

export interface ChipActions {
    onOpen: (shiftId: string) => void;
    /** Delete on a focused chip takes the person off. */
    onRemove: (source: DragSource) => void;
}

/** A shift in the Week table. Tap it to open the shift; Delete takes the person off. */
export function ShiftChip({
    shift,
    variant,
    actions,
}: {
    shift: SchedulerShift;
    variant: ChipVariant;
    actions: ChipActions;
}) {
    const source: DragSource | null =
        variant.kind === "assignment"
            ? { kind: "assignment", shiftId: shift.id, personId: variant.assignee.personId }
            : variant.kind === "open"
                ? { kind: "open", shiftId: shift.id }
                : null;

    const draft = shift.status === "draft" || (variant.kind === "assignment" && variant.assignee.pendingState === "add");
    const removed = shift.pendingRemoval || (variant.kind === "assignment" && variant.assignee.pendingState === "remove");
    const blocking = variant.kind === "assignment" ? isBlocking(variant.assignee) : shift.assignees.some(isBlocking);
    const softWarnings = variant.kind === "assignment" ? variant.assignee.warnings.filter((w) => w.severity === "warn") : [];
    const range = compactRange(shift.startLocal, shift.endLocal);

    const label = [
        range,
        shift.role,
        variant.kind === "open" ? `${shift.open} open` : null,
        variant.kind === "position" ? `${shift.filled} of ${shift.capacity} filled` : null,
        draft ? "not shared yet" : null,
        removed ? "being removed" : null,
        blocking ? "has a conflict" : null,
    ]
        .filter(Boolean)
        .join(", ");

    return (
        <button
            type="button"
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
                }
            }}
            className={cn(
                styles.chip,
                variant.kind === "open" && styles.open,
                draft && styles.draft,
                removed && styles.removed,
            )}
            style={{ ["--rc" as string]: roleColor(shift.role) }}
        >
            {shift.eventId ? <span aria-hidden className="text-[10px]">◆</span> : null}
            <span className={styles.time}>{range}</span>
            {variant.kind === "assignment" && variant.showRole ? <span className={styles.sub}>{shift.role}</span> : null}
            {variant.kind === "open" ? (
                <>
                    <span className={styles.sub}>{shift.role}</span>
                    <span className={cn(styles.fill, "text-warn")}>{shift.open}</span>
                </>
            ) : null}
            {variant.kind === "position" ? (
                <span className={cn(styles.fill, shift.open > 0 && "text-warn")}>
                    {shift.filled}/{shift.capacity}
                </span>
            ) : null}
            {shift.hasUnpublishedEdits && !draft ? <span aria-hidden className={styles.edited} /> : null}
            {blocking ? (
                <span aria-hidden className={styles.flag}>
                    !
                </span>
            ) : null}
        </button>
    );
}
