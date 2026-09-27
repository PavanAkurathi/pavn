"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import type { SchedulerPublishPerson, SchedulerWeek } from "@repo/contracts/scheduler";
import { Button } from "@repo/ui/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@repo/ui/components/ui/dialog";
import { fetchPublishPreview, publishWeek } from "@/lib/scheduler/client";
import { weekRangeLabel } from "@/lib/scheduler/format";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function describe(person: SchedulerPublishPerson) {
    return [
        person.added ? `${person.added} new` : null,
        person.changed ? `${person.changed} changed` : null,
        person.removed ? `${person.removed} removed` : null,
    ]
        .filter(Boolean)
        .join(", ");
}

/**
 * The last look before staff see the week: what changes, who hears about it
 * (once each), who has to be told another way, and anything still wrong.
 */
export function PublishDialog({
    week,
    open,
    onOpenChange,
    onPublished,
    onReview,
}: {
    week: SchedulerWeek;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onPublished: () => Promise<unknown>;
    /** Jump to a shift with a conflict. */
    onReview: (shiftId: string) => void;
}) {
    const { data: preview, error, isLoading } = useSWR(
        open ? (["scheduler-publish-preview", week.location.id, week.weekStart] as const) : null,
        fetchPublishPreview,
        { revalidateOnFocus: false },
    );
    const [publishing, setPublishing] = useState(false);
    const [showAll, setShowAll] = useState(false);
    const label = weekRangeLabel(week.days[0]!.localDate, week.days[6]!.localDate);
    const nothing = preview && preview.newShifts + preview.changedShifts + preview.removedShifts === 0;
    const conflicts = preview?.conflicts ?? [];

    const publish = async () => {
        setPublishing(true);
        try {
            const result = await publishWeek(week.location.id, week.weekStart, conflicts.length > 0);
            onOpenChange(false);
            await onPublished();
            toast.success(
                result.notify.length
                    ? `Published. ${plural(result.notify.length, "person", "people")} notified.`
                    : "Published.",
            );
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Couldn't publish");
        } finally {
            setPublishing(false);
        }
    };

    const people = preview?.notify ?? [];
    const shownPeople = showAll ? people : people.slice(0, 6);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        Publish {week.location.name}, {label}
                    </DialogTitle>
                    <DialogDescription>Only this week at this location. Staff see it in the app as soon as you publish.</DialogDescription>
                </DialogHeader>

                {isLoading ? <p className="text-sm text-muted-foreground">Checking the week…</p> : null}
                {error ? <p className="text-sm text-destructive">Couldn&apos;t check the week: {error.message}</p> : null}

                {preview ? (
                    nothing ? (
                        <p className="text-sm text-muted-foreground">Nothing to publish; staff already see this week as it is.</p>
                    ) : (
                        <div className="flex flex-col gap-4 text-sm">
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    ["New", preview.newShifts],
                                    ["Changed", preview.changedShifts],
                                    ["Removed", preview.removedShifts],
                                ].map(([name, count]) => (
                                    <div key={name} className="rounded-lg border px-3 py-2">
                                        <div className="text-xl font-semibold tabular-nums">{count}</div>
                                        <div className="text-xs text-muted-foreground">{name} shifts</div>
                                    </div>
                                ))}
                            </div>

                            {people.length ? (
                                <section className="flex flex-col gap-1.5">
                                    <h3 className="font-semibold">{plural(people.length, "person", "people")} get one message each</h3>
                                    <ul className="flex flex-col gap-0.5 text-muted-foreground">
                                        {shownPeople.map((p) => (
                                            <li key={p.personId}>
                                                <span className="text-foreground">{p.name}</span>: {describe(p)}
                                            </li>
                                        ))}
                                    </ul>
                                    {people.length > 6 ? (
                                        <button type="button" className="w-fit text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => setShowAll(!showAll)}>
                                            {showAll ? "Show fewer" : `Show all ${people.length}`}
                                        </button>
                                    ) : null}
                                    <p className="text-xs text-muted-foreground">Nobody else is messaged.</p>
                                </section>
                            ) : null}

                            {preview.unreachable.length ? (
                                <section className="flex flex-col gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                                    <h3 className="font-semibold text-amber-900">Tell these people yourself</h3>
                                    <p className="text-xs text-amber-900/80">They don&apos;t have the app yet, so they can&apos;t be messaged.</p>
                                    <ul className="text-amber-950">
                                        {preview.unreachable.map((p) => (
                                            <li key={p.personId}>
                                                {p.name}
                                                {p.kind === "agency" ? " (agency)" : " (invited)"}: {describe(p)}
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            ) : null}

                            {preview.openSlots ? (
                                <p>
                                    <span className="font-semibold">{plural(preview.openSlots, "open spot")}</span> will show as open to staff.
                                </p>
                            ) : null}

                            {preview.expiredDrafts ? (
                                <p className="text-xs text-muted-foreground">
                                    {plural(preview.expiredDrafts, "draft")} already ended and stay unpublished.
                                </p>
                            ) : null}

                            {conflicts.length ? (
                                <section className="flex flex-col gap-1.5 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2">
                                    <h3 className="font-semibold text-destructive">Still a problem</h3>
                                    <ul className="flex flex-col gap-1">
                                        {conflicts.map((c) => (
                                            <li key={`${c.shiftId}-${c.personId}`} className="flex items-start justify-between gap-2">
                                                <span>
                                                    <span className="font-medium">{c.personName}</span>
                                                    <span className="text-destructive">: {c.messages.join("; ")}</span>
                                                </span>
                                                <button
                                                    type="button"
                                                    className="shrink-0 text-xs font-medium text-primary hover:underline"
                                                    onClick={() => {
                                                        onOpenChange(false);
                                                        onReview(c.shiftId);
                                                    }}
                                                >
                                                    Review
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                    <p className="text-xs text-muted-foreground">Publishing anyway is recorded in the audit log.</p>
                                </section>
                            ) : null}
                        </div>
                    )
                ) : null}

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Not yet
                    </Button>
                    <Button disabled={!preview || nothing || publishing} variant={conflicts.length ? "destructive" : "default"} onClick={() => void publish()}>
                        {conflicts.length ? "Publish anyway" : "Publish"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
