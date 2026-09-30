"use client";

import { Plus, Sparkles } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import type { NeededItem } from "@/lib/scheduler/day-model";
import { compactRange } from "@/lib/scheduler/format";
import { roleColor } from "@/lib/scheduler/role-color";

/**
 * A spot nobody has yet. Dashed and warm so it reads as "still to do" at a
 * glance, with the one thing you do about it right on the card.
 */
export function NeededCard({
    item,
    onSuggest,
    onOpen,
}: {
    item: NeededItem;
    onSuggest: (shiftId: string) => void;
    onOpen: (shiftId: string) => void;
}) {
    const { shift, open } = item;
    const range = compactRange(shift.startLocal, shift.endLocal);
    const draft = shift.status === "draft";
    return (
        <div
            data-testid="needed-card"
            className="flex items-start gap-3 rounded-2xl border-2 border-dashed border-warn-line/60 bg-warn-soft/50 p-3.5"
        >
            <span
                aria-hidden
                className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-dashed border-warn-line/70 text-warn"
                style={{ background: `color-mix(in srgb, ${roleColor(shift.role)} 35%, white)` }}
            >
                <Plus className="size-5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                <button
                    type="button"
                    onClick={() => onOpen(shift.id)}
                    aria-label={`Change the ${shift.role} shift, ${range}`}
                    className="flex min-w-0 flex-col gap-0.5 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                    <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-base font-semibold">{shift.role} needed</span>
                        <span className="shrink-0 text-base font-semibold tabular-nums">{range}</span>
                    </span>
                    <span className={cn("text-sm font-medium text-warn")}>
                        {open === 1 ? "1 spot open" : `${open} spots open`}
                        {shift.capacity > open ? <span className="font-normal text-muted-foreground"> · {shift.filled} of {shift.capacity} filled</span> : null}
                        {draft ? <span className="font-normal text-muted-foreground"> · Not shared yet</span> : null}
                    </span>
                </button>
                <Button
                    type="button"
                    size="sm"
                    data-testid="suggest-button"
                    className="h-10 w-fit px-4"
                    onClick={() => onSuggest(shift.id)}
                    aria-label={`Suggest someone for ${shift.role}, ${range}`}
                >
                    <Sparkles data-icon="inline-start" />
                    Suggest
                </Button>
            </div>
        </div>
    );
}
