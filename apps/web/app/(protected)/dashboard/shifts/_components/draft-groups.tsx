"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ChevronRight, Inbox } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@repo/ui/components/ui/button";
import type { DraftGroup } from "@/lib/shifts/draft-groups";
import { getLocalParts, getShiftClock } from "@/lib/shifts/shift-time";
import { getSchedulerHref } from "@/lib/routes";
import { discardWeek } from "@/lib/scheduler/client";
import { timeAgo } from "@/lib/scheduler/request-format";
import { usePublish } from "@/lib/scheduler/use-publish";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** How long a first tap on Discard stays armed. */
const CONFIRM_WINDOW_MS = 2600;

function DraftGroupCard({ group }: { group: DraftGroup }) {
    const router = useRouter();
    const [expanded, setExpanded] = React.useState(false);
    const [confirming, setConfirming] = React.useState(false);
    const [discarding, setDiscarding] = React.useState(false);

    const schedulerHref = getSchedulerHref({ location: group.locationId, week: group.weekStart });

    // The same one-click publish as the Scheduler: a short undo window, and a
    // week with something still wrong goes to the Scheduler instead.
    const { phase, start } = usePublish({
        week: { weekStart: group.weekStart, location: { id: group.locationId ?? "" } },
        onNeedsReview: () => {
            toast("Something in this week needs a look before it can go out.");
            router.push(schedulerHref);
        },
        onPublished: async () => router.refresh(),
    });

    React.useEffect(() => {
        if (!confirming) return;
        const timer = window.setTimeout(() => setConfirming(false), CONFIRM_WINDOW_MS);
        return () => window.clearTimeout(timer);
    }, [confirming]);

    const discard = async () => {
        if (!group.locationId) return;
        if (!confirming) {
            setConfirming(true);
            return;
        }
        setDiscarding(true);
        try {
            await discardWeek(group.locationId, group.weekStart);
            toast.success("Draft discarded.");
            router.refresh();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Couldn't discard");
        } finally {
            setDiscarding(false);
            setConfirming(false);
        }
    };

    const weekLabel = `Week of ${format(parseISO(group.weekStart), "MMM d")}`;
    const bodyId = `draft-group-${group.key}`;
    const canAct = Boolean(group.locationId);

    return (
        <div className="overflow-hidden rounded-2xl border-[1.5px] border-dashed border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={bodyId}
                    onClick={() => setExpanded((open) => !open)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
                >
                    <ChevronRight
                        aria-hidden="true"
                        className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
                    />
                    <span className="min-w-0">
                        <span className="block text-[15.5px] font-extrabold text-foreground">{weekLabel}</span>
                        <span className="mt-0.5 block text-[12.5px] text-muted-foreground">
                            {plural(group.shifts.length, "shift")} · {group.open} open · {group.locationName}
                            {group.latestCreatedAt ? ` · added ${timeAgo(group.latestCreatedAt)}` : ""}
                        </span>
                    </span>
                </button>

                <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm" className="font-bold">
                        <Link href={schedulerHref}>Continue</Link>
                    </Button>
                    <Button
                        size="sm"
                        className="font-bold"
                        disabled={!canAct || phase !== "idle"}
                        onClick={() => void start()}
                    >
                        {phase === "idle" ? "Publish" : "Publishing…"}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className={`font-bold ${confirming ? "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:text-destructive-foreground" : "text-muted-foreground"}`}
                        disabled={!canAct || discarding}
                        onClick={() => void discard()}
                    >
                        {confirming ? "Confirm?" : "Discard"}
                    </Button>
                </div>
            </div>

            {expanded ? (
                <ul id={bodyId} className="border-t border-dashed border-border px-5 pb-3.5 pt-2">
                    {group.shifts.map((shift) => {
                        const start = parseISO(shift.startTime);
                        const clock = getShiftClock(start, parseISO(shift.endTime), shift.timezone);
                        const day = parseISO(getLocalParts(start, shift.timezone).date);
                        const total = shift.capacity?.total ?? 0;
                        const filled = shift.capacity?.filled ?? shift.assignedWorkers?.length ?? 0;
                        return (
                            <li
                                key={shift.id}
                                className="flex items-center gap-2.5 border-b border-border py-2.5 text-[13px] last:border-b-0"
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[13.5px] font-bold text-foreground">{shift.title}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {format(day, "EEE, MMM d")} · {clock.start} – {clock.end}
                                    </span>
                                </span>
                                <span className="whitespace-nowrap text-[13px] font-semibold text-muted-foreground">
                                    {filled} of {total} filled
                                </span>
                            </li>
                        );
                    })}
                </ul>
            ) : null}
        </div>
    );
}

export function DraftGroups({ groups }: { groups: DraftGroup[] }) {
    if (groups.length === 0) {
        return (
            <div className="rounded-2xl border-[1.5px] border-dashed border-border bg-card px-5 py-11 text-center text-muted-foreground">
                <Inbox aria-hidden="true" className="mx-auto mb-3 size-8 text-muted-foreground/50" />
                <p className="text-[15px] font-bold text-foreground">No drafts</p>
                <p className="mt-1 text-sm">Shifts you haven&apos;t published yet are kept here, a week at a time.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3.5">
            {groups.map((group) => (
                <DraftGroupCard key={group.key} group={group} />
            ))}
        </div>
    );
}
