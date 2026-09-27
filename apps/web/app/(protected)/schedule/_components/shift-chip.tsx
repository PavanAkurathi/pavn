"use client";

import Link from "next/link";
import type { SchedulerAssignee, SchedulerPerson, SchedulerShift } from "@repo/contracts/scheduler";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/ui/popover";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { compactRange, formatHours, weekdayShort } from "@/lib/scheduler/format";
import { roleColor } from "@/lib/scheduler/role-color";
import { isBlocking } from "@/lib/scheduler/view-model";
import { getShiftTimesheetHref } from "@/lib/routes";
import styles from "./scheduler.module.css";

type ChipVariant =
    /** On a person's row: this person's assignment. */
    | { kind: "assignment"; assignee: SchedulerAssignee; showRole: boolean }
    /** On the Open row: the slots nobody has yet. */
    | { kind: "open" }
    /** On a position row: the whole shift with its fill. */
    | { kind: "position" };

function statusLine(shift: SchedulerShift) {
    if (shift.pendingRemoval) return "Removed when you publish";
    if (shift.status === "draft") return "Draft, not visible to staff yet";
    if (shift.hasUnpublishedEdits) return "Published, with changes staff can't see yet";
    return "Published";
}

export function ShiftChip({
    shift,
    variant,
    people,
}: {
    shift: SchedulerShift;
    variant: ChipVariant;
    people: Map<string, SchedulerPerson>;
}) {
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
        draft ? "draft" : null,
        removed ? "being removed" : null,
        blocking ? "has a conflict" : null,
    ]
        .filter(Boolean)
        .join(", ");

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={label}
                    title={[label, ...softWarnings.map((w) => w.message)].join("\n")}
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
                            <span className={cn(styles.fill, "text-destructive")}>{shift.open}</span>
                        </>
                    ) : null}
                    {variant.kind === "position" ? (
                        <span className={cn(styles.fill, shift.open > 0 && "text-destructive")}>
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
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80">
                <ShiftDetails shift={shift} people={people} />
            </PopoverContent>
        </Popover>
    );
}

function ShiftDetails({ shift, people }: { shift: SchedulerShift; people: Map<string, SchedulerPerson> }) {
    return (
        <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                    <p className="font-semibold">
                        {weekdayShort(shift.localDate)} {compactRange(shift.startLocal, shift.endLocal)}
                        {shift.overnight ? <span className="font-normal text-muted-foreground"> (ends next day)</span> : null}
                    </p>
                    <p className="text-muted-foreground">
                        {shift.role} · {formatHours(shift.paidMinutes)} paid
                        {shift.breakMinutes ? ` · ${shift.breakMinutes} min break` : ""}
                    </p>
                </div>
                <Badge variant={shift.open > 0 ? "destructive" : "secondary"} className="shrink-0">
                    {shift.filled}/{shift.capacity}
                </Badge>
            </div>

            <p className="text-xs text-muted-foreground">{statusLine(shift)}</p>

            {shift.assignees.length ? (
                <ul className="flex flex-col gap-2">
                    {shift.assignees.map((a) => (
                        <li key={a.personId} className="flex flex-col gap-0.5">
                            <span className={cn("font-medium", a.pendingState === "remove" && "line-through opacity-60")}>
                                {people.get(a.personId)?.name ?? "Someone no longer on the team"}
                                {a.pendingState === "add" ? <span className="font-normal text-muted-foreground"> · not published yet</span> : null}
                            </span>
                            {a.warnings.map((w) => (
                                <span
                                    key={w.message}
                                    className={cn("text-xs", w.severity === "block" ? "text-destructive" : "text-amber-700")}
                                >
                                    {w.message}
                                </span>
                            ))}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-muted-foreground">Nobody on it yet.</p>
            )}

            {shift.note ? <p className="rounded-md bg-muted px-2 py-1.5 text-xs">{shift.note}</p> : null}

            <Button asChild size="sm" variant="outline" className="w-fit">
                <Link href={getShiftTimesheetHref(shift.id)}>Open shift</Link>
            </Button>
        </div>
    );
}
