"use client";

import { Lock, OctagonAlert, TriangleAlert } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { isLocked, type PersonItem } from "@/lib/scheduler/day-model";
import { compactRange, formatHours } from "@/lib/scheduler/format";
import { PersonAvatar } from "./person-avatar";

const chip = "rounded-full px-2 py-0.5 text-xs font-medium";

/**
 * One person on one shift, in words: who, what, when, and anything to know about
 * it. Tap it to change it. Problems are written out, not left to a colour or a badge.
 */
export function PersonCard({ item, onOpen }: { item: PersonItem; onOpen: (shiftId: string) => void }) {
    const { shift, assignee, person } = item;
    const removed = shift.pendingRemoval || assignee.pendingState === "remove";
    const notShared = !removed && (shift.status === "draft" || assignee.pendingState === "add");
    const changed = !removed && !notShared && shift.hasUnpublishedEdits;
    const locked = isLocked(shift);
    const blocking = assignee.warnings.filter((w) => w.severity === "block");
    const soft = assignee.warnings.filter((w) => w.severity === "warn");
    const range = compactRange(shift.startLocal, shift.endLocal);
    const name = person?.name ?? "Someone no longer on the team";

    return (
        <button
            type="button"
            data-testid="person-card"
            onClick={() => onOpen(shift.id)}
            aria-label={[
                `${name}, ${shift.role}, ${range}`,
                removed ? "goes away when you publish" : null,
                notShared ? "not shared yet" : null,
                changed ? "changed, not shared yet" : null,
                ...blocking.map((w) => w.message),
                ...soft.map((w) => w.message),
            ]
                .filter(Boolean)
                .join(". ")}
            className={cn(
                "flex w-full items-start gap-3 rounded-2xl border bg-card p-3.5 text-left shadow-card outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                blocking.length > 0 && !removed && "border-destructive/40",
                removed && "opacity-70",
            )}
        >
            <PersonAvatar person={person} role={shift.role} />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-baseline justify-between gap-3">
                    <span className={cn("truncate text-base font-semibold", removed && "line-through")}>{name}</span>
                    <span className={cn("shrink-0 text-base font-semibold tabular-nums", removed && "line-through")}>{range}</span>
                </span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                    <span>{shift.role}</span>
                    <span aria-hidden>·</span>
                    <span>{formatHours(shift.paidMinutes)} paid</span>
                    {person?.kind === "invited" ? <span className={cn(chip, "bg-warn-soft text-warn")}>Invited</span> : null}
                    {person?.kind === "agency" ? <span className={cn(chip, "bg-muted text-foreground/70")}>Agency</span> : null}
                    {notShared ? <span className={cn(chip, "border border-dashed text-foreground/70")}>Not shared yet</span> : null}
                    {changed ? <span className={cn(chip, "border border-dashed text-foreground/70")}>Changed, not shared yet</span> : null}
                    {removed ? <span className={cn(chip, "bg-muted text-foreground/70")}>Goes away when you publish</span> : null}
                    {locked ? (
                        <span className={cn(chip, "inline-flex items-center gap-1 bg-muted text-foreground/70")}>
                            <Lock aria-hidden className="size-3" />
                            {shift.status === "in-progress" ? "Started" : shift.status === "cancelled" ? "Cancelled" : "Done"}
                        </span>
                    ) : null}
                </span>
                {removed
                    ? null
                    : [...blocking, ...soft].map((w) => (
                          <span
                              key={`${w.type}:${w.message}`}
                              className={cn(
                                  "flex items-start gap-1.5 text-sm font-medium",
                                  w.severity === "block" ? "text-destructive" : "text-warn",
                              )}
                          >
                              {w.severity === "block" ? (
                                  <OctagonAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                              ) : (
                                  <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                              )}
                              {w.message}
                          </span>
                      ))}
            </span>
        </button>
    );
}
