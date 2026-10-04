"use client";

import type { SchedulerWeek } from "@repo/contracts/scheduler";
import { pillVariants } from "@repo/ui/components/app/pill";
import { cn } from "@repo/ui/lib/utils";

type ChipTone = "neutral" | "danger";

function StatChip({
    count,
    label,
    tone = "neutral",
    title,
    onClick,
}: {
    count: number;
    label: string;
    tone?: ChipTone;
    title?: string;
    onClick?: () => void;
}) {
    const className = cn(
        pillVariants({ tone, size: "md" }),
        "gap-1",
        onClick && "cursor-pointer transition-colors hover:bg-muted-foreground/15 focus-visible:outline-2 focus-visible:outline-ring",
        onClick && tone === "danger" && "hover:bg-destructive/20",
    );
    const body = (
        <>
            <b className={cn("tabular-nums", tone === "neutral" && "text-foreground")}>{count}</b> {label}
        </>
    );
    return onClick ? (
        <button type="button" className={className} title={title} onClick={onClick}>
            {body}
        </button>
    ) : (
        <span className={className} title={title}>
            {body}
        </span>
    );
}

/**
 * What the week holds, at a glance: shifts, what is still open, what staff
 * can't see yet, and what is waiting on you. Open and requests are buttons:
 * open marks the open cards, requests goes to the Requests page.
 */
export function WeekStats({
    week,
    onOpen,
    onRequests,
}: {
    week: SchedulerWeek;
    onOpen: () => void;
    onRequests: () => void;
}) {
    const { openSlots, pendingChangeCount, pendingRequestCount } = week.summary;
    const shifts = week.shifts.filter((s) => !s.pendingRemoval).length;

    return (
        <div aria-label="This week" role="group" className="flex flex-wrap items-center gap-2">
            <StatChip count={shifts} label={shifts === 1 ? "shift" : "shifts"} />
            {openSlots > 0 ? <StatChip count={openSlots} label="open" title="Show the open spots" onClick={onOpen} /> : null}
            {pendingChangeCount > 0 ? (
                <StatChip count={pendingChangeCount} label={pendingChangeCount === 1 ? "draft" : "drafts"} title="Drafts and edits staff can't see yet" />
            ) : null}
            {pendingRequestCount > 0 ? (
                <StatChip
                    count={pendingRequestCount}
                    label={pendingRequestCount === 1 ? "request" : "requests"}
                    title="Waiting for you"
                    onClick={onRequests}
                />
            ) : null}
        </div>
    );
}
