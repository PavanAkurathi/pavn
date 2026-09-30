"use client";

import { CalendarOff, Plus } from "lucide-react";
import type { SchedulerWeek } from "@repo/contracts/scheduler";
import { Button } from "@repo/ui/components/ui/button";
import type { DayModel } from "@/lib/scheduler/day-model";
import { dayHeading, formatHours } from "@/lib/scheduler/format";
import { EventCard } from "./event-card";
import { NeededCard } from "./needed-card";
import { PersonCard } from "./person-card";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The selected day, top to bottom: events, then morning, afternoon and evening, then who's away. */
export function DayPanel({
    week,
    dayIndex,
    model,
    weekIsEmpty,
    filtered,
    onOpenShift,
    onSuggest,
    onOpenEvent,
    onAdd,
    onCopyWeek,
    onTemplate,
}: {
    week: SchedulerWeek;
    dayIndex: number;
    model: DayModel;
    weekIsEmpty: boolean;
    /** A department or search is hiding some of the day. */
    filtered: boolean;
    onOpenShift: (shiftId: string) => void;
    onSuggest: (shiftId: string) => void;
    onOpenEvent: (eventId: string) => void;
    onAdd: (dayIndex: number) => void;
    onCopyWeek: () => void;
    onTemplate: () => void;
}) {
    const day = week.days[dayIndex]!;
    const nothing = model.groups.length === 0 && model.events.length === 0;
    const summary = [
        plural(model.working, "person", "people"),
        model.open > 0 ? `${plural(model.open, "spot")} open` : null,
        model.paidMinutes > 0 ? formatHours(model.paidMinutes) : null,
    ].filter(Boolean);

    return (
        <section
            id="day-panel"
            role="tabpanel"
            aria-labelledby={`day-tab-${dayIndex}`}
            data-testid="day-panel"
            className="flex w-full flex-col gap-5"
        >
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                <div className="flex flex-col gap-0.5">
                    <h2 className="text-2xl font-semibold tracking-tight">
                        {dayHeading(day.localDate)}
                        {day.isToday ? <span className="ml-2 align-middle text-sm font-medium text-primary">Today</span> : null}
                    </h2>
                    <p className="text-sm text-muted-foreground" aria-live="polite">
                        {summary.join(" · ")}
                    </p>
                </div>
            </div>

            {model.events.length > 0 ? (
                <div className="flex flex-col gap-3">
                    {model.events.map((e) => (
                        <EventCard key={e.id} event={e} onOpen={onOpenEvent} />
                    ))}
                </div>
            ) : null}

            {model.groups.map((group) => (
                <section key={group.part} aria-labelledby={`part-${group.part}`} className="flex flex-col gap-3">
                    <h3 id={`part-${group.part}`} className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        {group.label}
                    </h3>
                    <div className="grid gap-3 md:grid-cols-2">
                        {group.needed.map((item) => (
                            <NeededCard key={`n:${item.shift.id}`} item={item} onSuggest={onSuggest} onOpen={onOpenShift} />
                        ))}
                        {group.people.map((item) => (
                            <PersonCard key={`p:${item.shift.id}:${item.assignee.personId}`} item={item} onOpen={onOpenShift} />
                        ))}
                    </div>
                </section>
            ))}

            {nothing ? (
                <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed bg-card px-6 py-12 text-center">
                    <p className="text-lg font-semibold">
                        {filtered ? "Nobody matches here" : `Nothing planned for ${dayHeading(day.localDate).split(",")[0]}`}
                    </p>
                    <p className="max-w-sm text-sm text-muted-foreground">
                        {filtered
                            ? "Try another department, or clear the search."
                            : "Add a shift and it stays with you until you publish."}
                    </p>
                    {filtered ? null : (
                        <div className="flex flex-wrap justify-center gap-2">
                            <Button type="button" onClick={() => onAdd(dayIndex)}>
                                <Plus data-icon="inline-start" />
                                Add a shift
                            </Button>
                            {weekIsEmpty ? (
                                <>
                                    <Button type="button" variant="outline" onClick={onCopyWeek}>
                                        Copy last week
                                    </Button>
                                    <Button type="button" variant="outline" onClick={onTemplate}>
                                        Use a template
                                    </Button>
                                </>
                            ) : null}
                        </div>
                    )}
                </div>
            ) : null}

            {model.away.length > 0 ? (
                <div className="flex items-start gap-2.5 rounded-2xl bg-muted px-4 py-3 text-sm">
                    <CalendarOff aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <p>
                        <span className="font-semibold">Away: </span>
                        <span className="text-foreground/80">{model.away.map((a) => a.text).join(" · ")}</span>
                    </p>
                </div>
            ) : null}
        </section>
    );
}
