"use client";

import { CircleCheck, CircleAlert, Sparkle } from "lucide-react";
import type { SchedulerEvent } from "@repo/contracts/scheduler";
import { cn } from "@repo/ui/lib/utils";
import { compactRange } from "@/lib/scheduler/format";

/** An event on this day: what it is, when, and how staffed, in words. Opens the event panel. */
export function EventCard({ event, onOpen }: { event: SchedulerEvent; onOpen: (eventId: string) => void }) {
    const staffed = event.needed === 0 || event.filled >= event.needed;
    const Icon = staffed ? CircleCheck : CircleAlert;
    return (
        <button
            type="button"
            data-testid="event-card"
            onClick={() => onOpen(event.id)}
            className="flex w-full items-center gap-3 rounded-2xl border bg-card p-3.5 text-left shadow-card outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
                <Sparkle className="size-5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-base font-semibold">{event.name}</span>
                    <span className="shrink-0 text-base font-semibold tabular-nums">{compactRange(event.startLocal, event.endLocal)}</span>
                </span>
                <span className={cn("flex items-center gap-1.5 text-sm font-medium", staffed ? "text-ok" : "text-warn")}>
                    <Icon aria-hidden className="size-4" />
                    {event.needed === 0 ? "No staff needed yet" : `${event.filled} of ${event.needed} staffed`}
                </span>
            </span>
        </button>
    );
}
