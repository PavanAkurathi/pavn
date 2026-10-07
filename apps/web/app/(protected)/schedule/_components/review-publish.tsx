"use client";

import { useEffect, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import type { SchedulerPublishPerson, SchedulerPublishPreview, SchedulerWeek } from "@repo/contracts/scheduler";
import { Button } from "@repo/ui/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@repo/ui/components/ui/dialog";
import { fetchPublishPreview, publishWeek } from "@/lib/scheduler/client";
import { shortDate, weekRangeLabel } from "@/lib/scheduler/format";
import type { SiteScope } from "@/lib/scheduler/workspace";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function describe(person: SchedulerPublishPerson) {
    return [person.added ? `${person.added} new` : null, person.changed ? `${person.changed} changed` : null, person.removed ? `${person.removed} removed` : null]
        .filter(Boolean)
        .join(", ");
}

/** Positions in drafts that are still unfilled: the ones this publish makes open for pickup. */
function newlyOpen(week: SchedulerWeek): number {
    return week.shifts.filter((s) => s.status === "draft" && !s.pendingRemoval).reduce((sum, s) => sum + s.open, 0);
}

/** The days in a site's week that have something staff can't see yet. */
function datesAffected(week: SchedulerWeek): string[] {
    const dates = new Set<string>();
    for (const s of week.shifts) {
        if (s.status === "draft" || s.hasUnpublishedEdits || s.pendingRemoval || s.assignees.some((a) => a.pendingState !== null)) dates.add(s.localDate);
    }
    return [...dates].sort().map(shortDate);
}

type Previews = Record<string, SchedulerPublishPreview>;

async function fetchPreviews([, siteIds, weekStart]: readonly [string, string, string]): Promise<Previews> {
    const ids = siteIds.split(",");
    const previews = await Promise.all(ids.map((id) => fetchPublishPreview(["scheduler-publish-preview", id, weekStart] as const)));
    return Object.fromEntries(ids.map((id, i) => [id, previews[i]!]));
}

/**
 * Everything that would change for staff, before it does. The scope is spelled
 * out: which sites, which dates, and any site the filter leaves out is named
 * rather than quietly left unpublished or quietly included. Positions nobody
 * has taken are not a problem: they are listed as what will open for pickup.
 */
export function ReviewPublish({
    weeks,
    excluded,
    open,
    onOpenChange,
    onPublished,
    onReview,
}: {
    /** The sites in view that have something to publish. */
    weeks: SchedulerWeek[];
    /** Sites with changes that the site filter leaves out. */
    excluded: SiteScope[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onPublished: () => Promise<unknown>;
    /** Jump to a shift with a conflict. */
    onReview: (shiftId: string) => void;
}) {
    const weekStart = weeks[0]?.weekStart ?? "";
    const siteIds = weeks.map((w) => w.location.id).join(",");
    const { data: previews, error, isLoading } = useSWR(open && weeks.length ? (["scheduler-review", siteIds, weekStart] as const) : null, fetchPreviews, { revalidateOnFocus: false });
    // Drop the answer when the dialog closes, so the next open shows "Checking…" rather than the last publish's summary.
    const { mutate } = useSWRConfig();
    useEffect(() => {
        if (!open) void mutate((key) => Array.isArray(key) && key[0] === "scheduler-review", undefined, { revalidate: false });
    }, [open, mutate]);
    const [publishing, setPublishing] = useState(false);
    const [done, setDone] = useState<{ sites: string[]; people: number } | null>(null);

    const previewList = previews ? weeks.map((w) => ({ week: w, preview: previews[w.location.id]! })).filter((x) => x.preview) : [];
    const changes = (p: SchedulerPublishPreview) => p.newShifts + p.changedShifts + p.removedShifts;
    const withChanges = previewList.filter((x) => changes(x.preview) > 0);
    const conflicts = previewList.reduce((sum, x) => sum + x.preview.conflicts.length, 0);
    const expired = previewList.reduce((sum, x) => sum + x.preview.expiredDrafts, 0);
    const openPositions = withChanges.reduce((sum, x) => sum + newlyOpen(x.week), 0);
    const label = weeks[0] ? weekRangeLabel(weeks[0].days[0]!.localDate, weeks[0].days[6]!.localDate) : "";

    const publish = async () => {
        setPublishing(true);
        try {
            const results = [];
            for (const { week, preview } of withChanges) {
                results.push({ site: week.location.name, result: await publishWeek(week.location.id, week.weekStart, preview.conflicts.length > 0) });
            }
            const people = new Set(results.flatMap((r) => r.result.notify.map((p) => p.personId))).size;
            await onPublished();
            setDone({ sites: results.map((r) => r.site), people });
            toast.success(people ? `Published. ${plural(people, "person", "people")} notified.` : "Published.");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Couldn't publish");
        } finally {
            setPublishing(false);
        }
    };

    const close = (next: boolean) => {
        if (!next) setDone(null);
        onOpenChange(next);
    };

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
                {done ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>Published</DialogTitle>
                            <DialogDescription>
                                {done.sites.join(", ")} · {label}. {done.people ? `${plural(done.people, "person", "people")} got one message each.` : "Nobody needed a message."}
                            </DialogDescription>
                        </DialogHeader>
                        <p className="text-sm text-muted-foreground">Both views now show these shifts as published.</p>
                        <DialogFooter>
                            <Button onClick={() => close(false)}>Done</Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle>Review &amp; publish</DialogTitle>
                            <DialogDescription>
                                {label} · {weeks.map((w) => w.location.name).join(", ") || "No sites in view"}. Staff see these changes as soon as you publish.
                            </DialogDescription>
                        </DialogHeader>

                        {isLoading ? <p className="text-sm text-muted-foreground">Checking what would change…</p> : null}
                        {error ? <p className="text-sm text-destructive">Couldn&apos;t check the week: {error.message}</p> : null}

                        {previews && withChanges.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                {expired > 0
                                    ? `${plural(expired, "draft")} here already ended, so staff can't be shown ${expired === 1 ? "it" : "them"}. Discard ${expired === 1 ? "it" : "them"} from the ⋯ menu, or add ${expired === 1 ? "it" : "them"} again on a later day.`
                                    : "Nothing to publish here; staff already see this as it is."}
                            </p>
                        ) : null}

                        <div className="flex flex-col gap-5 text-sm">
                            {withChanges.map(({ week, preview }) => (
                                <section key={week.location.id} className="flex flex-col gap-2" aria-label={week.location.name}>
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-b pb-1">
                                        <h3 className="font-bold">{week.location.name}</h3>
                                        <span className="text-xs text-muted-foreground">{datesAffected(week).join(" · ")}</span>
                                    </div>
                                    <p>
                                        <span className="font-semibold">{plural(preview.newShifts, "new shift")}</span>
                                        {" · "}
                                        {preview.changedShifts} changed · {preview.removedShifts} removed
                                    </p>

                                    {preview.notify.length ? (
                                        <div>
                                            <p className="font-semibold">{plural(preview.notify.length, "person", "people")} {preview.notify.length === 1 ? "gets" : "get"} one message each</p>
                                            <ul className="mt-0.5 text-muted-foreground">
                                                {preview.notify.slice(0, 6).map((p) => (
                                                    <li key={p.personId}>
                                                        <span className="text-foreground">{p.name}</span>: {describe(p)}
                                                    </li>
                                                ))}
                                                {preview.notify.length > 6 ? <li>and {preview.notify.length - 6} more</li> : null}
                                            </ul>
                                        </div>
                                    ) : null}

                                    {preview.unreachable.length ? (
                                        <div>
                                            <p className="font-semibold">Tell these people yourself</p>
                                            <p className="text-xs text-muted-foreground">They don&apos;t have the app yet, so they can&apos;t be messaged.</p>
                                            <ul className="mt-0.5 text-muted-foreground">
                                                {preview.unreachable.map((p) => (
                                                    <li key={p.personId}>
                                                        <span className="text-foreground">{p.name}</span> ({p.kind === "agency" ? "agency" : "not on the app yet"}): {describe(p)}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ) : null}

                                    {newlyOpen(week) ? (
                                        <p>
                                            <span className="font-semibold">{plural(newlyOpen(week), "position")}</span> will open for pickup where needed.
                                        </p>
                                    ) : null}

                                    {preview.expiredDrafts ? <p className="text-xs text-muted-foreground">{plural(preview.expiredDrafts, "draft")} already ended and stay unpublished.</p> : null}

                                    {preview.conflicts.length ? (
                                        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2">
                                            <p className="font-semibold text-destructive">Still a problem</p>
                                            <ul className="mt-1 flex flex-col gap-1">
                                                {preview.conflicts.map((c) => (
                                                    <li key={`${c.shiftId}-${c.personId}`} className="flex items-start justify-between gap-2">
                                                        <span>
                                                            <span className="font-medium">{c.personName}</span>
                                                            <span className="text-destructive">: {c.messages.join("; ")}</span>
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className="shrink-0 text-xs font-semibold text-primary hover:underline"
                                                            onClick={() => {
                                                                close(false);
                                                                onReview(c.shiftId);
                                                            }}
                                                        >
                                                            Review
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                            <p className="mt-1 text-xs text-muted-foreground">Publishing anyway is recorded in the audit log.</p>
                                        </div>
                                    ) : null}
                                </section>
                            ))}

                            {excluded.length ? (
                                <section className="rounded-lg border border-dashed px-3 py-2" aria-label="Not included">
                                    <p className="font-semibold">Not included</p>
                                    <p className="text-muted-foreground">
                                        {excluded.map((s) => `${plural(s.pending, "change")} at ${s.site.name}`).join(", ")} stay unpublished. Switch to All sites to review them too.
                                    </p>
                                </section>
                            ) : null}
                        </div>

                        <DialogFooter>
                            <Button variant="ghost" onClick={() => close(false)}>
                                Not yet
                            </Button>
                            <Button disabled={!previews || withChanges.length === 0 || publishing} variant={conflicts > 0 ? "destructive" : "default"} onClick={() => void publish()}>
                                {publishing ? "Publishing…" : conflicts > 0 ? "Publish anyway" : openPositions > 0 ? "Publish and open positions" : "Publish"}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
