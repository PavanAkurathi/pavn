"use client";

import { FileText, Loader2 } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { useConfirm } from "@/components/ui/use-confirm";
import type { Shift } from "@/lib/types";

interface DraftPublishBarProps {
    drafts: Shift[];
    /** What the drafts are scoped to, e.g. "this week" — used in the copy. */
    scopeLabel: string;
    isPublishing: boolean;
    onPublish: () => void;
}

/**
 * The step that turns a filled-in week into a real one.
 *
 * Copying a week, or saving a schedule as a draft, leaves shifts on the calendar
 * that nobody has been told about. This is where that gets fixed — it only
 * appears while there is something unannounced in view, and it says how many
 * people are about to hear about it, because that is the part that cannot be
 * taken back.
 */
export function DraftPublishBar({ drafts, scopeLabel, isPublishing, onPublish }: DraftPublishBarProps) {
    const { confirm, confirmDialog } = useConfirm();

    if (drafts.length === 0) return null;

    const assignedCount = drafts.reduce(
        (sum, shift) => sum + (shift.capacity?.filled ?? shift.assignedWorkers?.length ?? 0),
        0,
    );
    // Only roster workers have the app. Invited and agency people are assigned
    // but unreachable, so promising to notify them would be a lie.
    const notifiableCount = drafts.reduce(
        (sum, shift) =>
            sum + (shift.assignedWorkers ?? []).filter((worker) => (worker.kind ?? "roster") === "roster").length,
        0,
    );
    const openSlots = drafts.reduce(
        (sum, shift) =>
            sum + Math.max((shift.capacity?.total ?? 0) - (shift.capacity?.filled ?? shift.assignedWorkers?.length ?? 0), 0),
        0,
    );

    const handleClick = async () => {
        const slotClause = openSlots > 0
            ? ` ${openSlots} slot${openSlots === 1 ? "" : "s"} will open up for anyone to claim.`
            : "";
        const notifyClause = notifiableCount > 0
            ? `${notifiableCount} worker${notifiableCount === 1 ? "" : "s"} will be notified on the app.`
            : assignedCount > 0
                ? "The assigned workers are invited or agency, so nobody gets an app notification — tell them yourself."
                : "Nobody is assigned yet, so these go out as open shifts.";

        const ok = await confirm({
            title: `Publish ${drafts.length} draft shift${drafts.length === 1 ? "" : "s"}?`,
            description: `${notifyClause}${slotClause}`,
            confirmLabel: "Publish",
        });
        if (!ok) return;
        onPublish();
    };

    return (
        <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-amber-300 bg-amber-50/60 px-4 py-3">
                <div className="flex items-start gap-2.5">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <div className="text-sm">
                        <p className="font-semibold text-amber-900">
                            {drafts.length} unpublished shift{drafts.length === 1 ? "" : "s"} {scopeLabel}
                        </p>
                        <p className="text-xs text-amber-800/80">
                            {assignedCount > 0
                                ? `${assignedCount} worker${assignedCount === 1 ? "" : "s"} assigned, but nobody has been told yet.`
                                : "No workers assigned yet — publishing sends these out as open shifts."}
                        </p>
                    </div>
                </div>

                <Button size="sm" onClick={handleClick} disabled={isPublishing}>
                    {isPublishing ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Publishing…
                        </>
                    ) : (
                        `Publish ${drafts.length === 1 ? "shift" : "all"}`
                    )}
                </Button>
            </div>
            {confirmDialog}
        </>
    );
}
