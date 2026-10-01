"use client";

import { CircleCheck, CirclePlus, Inbox, TriangleAlert } from "lucide-react";
import type { SchedulerWeek } from "@repo/contracts/scheduler";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/ui/popover";
import { cn } from "@repo/ui/lib/utils";
import type { WeekIssues } from "@/lib/scheduler/day-model";
import { compactRange, weekdayShort } from "@/lib/scheduler/format";

const chip =
    "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/**
 * The week in three sentences: spots still open, things to check, requests
 * waiting. Each one takes you to the thing it counts.
 */
export function WeekSummary({
    week,
    issues,
    openSpots,
    onGoToOpen,
    onGoToIssue,
    onRequests,
}: {
    week: SchedulerWeek;
    issues: WeekIssues;
    openSpots: number;
    onGoToOpen: () => void;
    onGoToIssue: (dayIndex: number, shiftId: string) => void;
    onRequests: () => void;
}) {
    const { pendingChangeCount, pendingRequestCount } = week.summary;
    const blocking = issues.issues.filter((i) => i.warning.severity === "block");
    const quiet = openSpots === 0 && blocking.length === 0 && pendingRequestCount === 0;

    return (
        <div className="flex flex-wrap items-center gap-2" data-testid="week-summary">
            {openSpots > 0 ? (
                <button type="button" onClick={onGoToOpen} className={cn(chip, "border-warn-line/50 bg-warn-soft text-warn hover:bg-warn-soft/70")}>
                    <CirclePlus aria-hidden className="size-4" />
                    {openSpots === 1 ? "1 spot open" : `${openSpots} spots open`}
                </button>
            ) : null}

            {blocking.length > 0 ? (
                <Popover>
                    <PopoverTrigger asChild>
                        <button type="button" className={cn(chip, "border-destructive/40 bg-primary-soft text-destructive hover:bg-primary-soft/70")}>
                            <TriangleAlert aria-hidden className="size-4" />
                            {blocking.length} to check
                        </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[min(24rem,calc(100vw-2rem))] p-2">
                        <p className="px-2 pb-1 pt-1 text-sm font-semibold">These need a look</p>
                        <ul className="flex flex-col">
                            {blocking.map((issue) => {
                                const day = week.days[issue.dayIndex]!;
                                const shift = week.shifts.find((s) => s.id === issue.shiftId);
                                return (
                                    <li key={issue.key}>
                                        <button
                                            type="button"
                                            onClick={() => onGoToIssue(issue.dayIndex, issue.shiftId)}
                                            className="flex w-full flex-col gap-0.5 rounded-xl px-2 py-2 text-left hover:bg-muted"
                                        >
                                            <span className="text-sm font-semibold">
                                                {issue.personName}
                                                <span className="font-normal text-muted-foreground">
                                                    {" "}
                                                    · {weekdayShort(day.localDate)}
                                                    {shift ? ` ${compactRange(shift.startLocal, shift.endLocal)}` : ""}
                                                </span>
                                            </span>
                                            <span className="text-sm text-destructive">{issue.warning.message}</span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </PopoverContent>
                </Popover>
            ) : null}

            {pendingRequestCount > 0 ? (
                <button type="button" onClick={onRequests} className={cn(chip, "bg-card hover:bg-muted")}>
                    <Inbox aria-hidden className="size-4" />
                    {pendingRequestCount === 1 ? "1 request" : `${pendingRequestCount} requests`}
                    <span className="text-muted-foreground">waiting on you</span>
                </button>
            ) : null}

            {quiet && week.shifts.length > 0 ? (
                <span className="inline-flex h-10 items-center gap-2 px-1 text-sm font-medium text-ok">
                    <CircleCheck aria-hidden className="size-4" />
                    {pendingChangeCount === 0 ? "Everything is filled and shared" : "Everything is filled"}
                </span>
            ) : null}
        </div>
    );
}
