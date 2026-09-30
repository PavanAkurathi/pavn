"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { SchedulerWeek } from "@repo/contracts/scheduler";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@repo/ui/components/ui/alert-dialog";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@repo/ui/components/ui/sheet";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { cn } from "@repo/ui/lib/utils";
import { compactRange, weekdayShort } from "@/lib/scheduler/format";
import { formatTimeRange, parseTimeRange } from "@/lib/scheduler/parse-time-range";
import { newShiftId, planCreateEvent, planDeleteEvent, planUpdateEvent, type Plan } from "@/lib/scheduler/plans";
import { knownRoles } from "./add-shift-sheet";

export type EventEditTarget = { mode: "new"; dayIndex: number } | { mode: "edit"; eventId: string };

export function EventDrawer({
    week,
    target,
    onClose,
    run,
    onStaff,
}: {
    week: SchedulerWeek;
    target: EventEditTarget | null;
    onClose: () => void;
    run: (plan: Plan) => Promise<boolean>;
    onStaff: (shiftId: string) => void;
}) {
    const event = target?.mode === "edit" ? week.events.find((e) => e.id === target.eventId) ?? null : null;
    const open = target !== null && (target.mode === "new" || event !== null);
    const key = target?.mode === "edit" ? `${target.eventId}:${event?.startsAt}:${event?.name}` : `new:${target?.dayIndex}`;
    return (
        <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
            <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
                {open && target ? <EventPanel key={key} week={week} target={target} run={run} onClose={onClose} onStaff={onStaff} /> : null}
            </SheetContent>
        </Sheet>
    );
}

function EventPanel({
    week,
    target,
    run,
    onClose,
    onStaff,
}: {
    week: SchedulerWeek;
    target: EventEditTarget;
    run: (plan: Plan) => Promise<boolean>;
    onClose: () => void;
    onStaff: (shiftId: string) => void;
}) {
    const event = target.mode === "edit" ? week.events.find((e) => e.id === target.eventId)! : null;
    const roles = useMemo(() => knownRoles(week), [week]);
    const [name, setName] = useState(event?.name ?? "");
    const [dayIndex, setDayIndex] = useState(String(event ? event.dayIndex : target.mode === "new" ? target.dayIndex : 0));
    const [time, setTime] = useState(event ? formatTimeRange(event.startLocal, event.endLocal) : "4p-11p");
    const [notes, setNotes] = useState(event?.notes ?? "");
    const [needs, setNeeds] = useState<{ role: string; count: number }[]>(event ? [] : [{ role: roles[0] ?? "", count: 1 }]);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [saving, setSaving] = useState(false);

    const range = parseTimeRange(time);
    const eventShifts = event ? week.shifts.filter((s) => s.eventId === event.id && !s.pendingRemoval) : [];
    const draft = range ? { name: name.trim(), dayIndex: Number(dayIndex), startLocal: range.startLocal, endLocal: range.endLocal, notes: notes.trim() || null } : null;
    const valid = Boolean(draft && draft.name);

    const save = async () => {
        if (!draft || !draft.name) return;
        setSaving(true);
        try {
            if (!event) {
                if (await run(planCreateEvent(week, draft, needs))) onClose();
                return;
            }
            const changes = planUpdateEvent(week, event.id, draft)?.changes ?? [];
            // New roles added from this panel, at the event's (new) time.
            for (const need of needs.filter((n) => n.role.trim() && n.count > 0)) {
                changes.push({
                    op: "create",
                    shiftId: newShiftId(),
                    shift: {
                        locationId: week.location.id,
                        localDate: week.days[draft.dayIndex]!.localDate,
                        startLocal: draft.startLocal,
                        endLocal: draft.endLocal,
                        role: need.role.trim(),
                        capacity: need.count,
                        eventId: event.id,
                    },
                    assignees: [],
                });
            }
            if (changes.length === 0) return;
            if (await run({ changes, label: `Changed ${draft.name}` })) setNeeds([]);
        } finally {
            setSaving(false);
        }
    };

    const needed = eventShifts.reduce((n, s) => n + s.capacity, 0);
    const filled = eventShifts.reduce((n, s) => n + Math.min(s.filled, s.capacity), 0);

    return (
        <>
            <SheetHeader className="gap-1 border-b p-5 text-left">
                <SheetTitle className="flex items-center justify-between gap-3">
                    <span>{event ? event.name : "New event"}</span>
                    {event ? (
                        <Badge variant="secondary" className={filled < needed ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok"}>
                            {filled}/{needed} staffed
                        </Badge>
                    ) : null}
                </SheetTitle>
                <SheetDescription>
                    {event ? "Change the event, or staff its shifts." : "One open shift per role, ready to staff. Everything stays a draft until you publish."}
                </SheetDescription>
            </SheetHeader>

            <form
                className="flex flex-col gap-5 p-5"
                onSubmit={(e) => {
                    e.preventDefault();
                    void save();
                }}
            >
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium" htmlFor="ev-name">
                        Name
                    </label>
                    <Input id="ev-name" autoFocus={!event} value={name} placeholder="Smith Wedding" onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium" htmlFor="ev-day">
                            Day
                        </label>
                        <Select value={dayIndex} onValueChange={setDayIndex}>
                            <SelectTrigger id="ev-day">
                                <SelectValue>{weekdayShort(week.days[Number(dayIndex)]!.localDate)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {week.days.map((d) => (
                                    <SelectItem key={d.index} value={String(d.index)}>
                                        {weekdayShort(d.localDate)} {Number(d.localDate.slice(8))}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium" htmlFor="ev-time">
                            Time
                        </label>
                        <Input id="ev-time" value={time} onChange={(e) => setTime(e.target.value)} aria-invalid={!range} />
                        {!range ? <span className="text-xs text-destructive">Try 4p-11p</span> : null}
                    </div>
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium" htmlFor="ev-notes">
                        Notes
                    </label>
                    <Textarea id="ev-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="120 guests. Load-in from the back dock." />
                </div>

                {event ? (
                    <section className="flex flex-col gap-2" aria-labelledby="ev-shifts">
                        <h3 id="ev-shifts" className="text-sm font-semibold">
                            Staffing
                        </h3>
                        {eventShifts.length === 0 ? <p className="text-sm text-muted-foreground">No shifts yet. Add the roles you need below.</p> : null}
                        <ul className="flex flex-col gap-1">
                            {eventShifts.map((s) => (
                                <li key={s.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60">
                                    <span className="text-sm">
                                        <span className="font-medium">{s.role}</span>
                                        <span className="text-muted-foreground"> · {compactRange(s.startLocal, s.endLocal)}</span>
                                    </span>
                                    <span className="flex items-center gap-2">
                                        <span className={cn("text-sm font-semibold tabular-nums", s.open > 0 && "text-warn")}>
                                            {s.filled}/{s.capacity}
                                        </span>
                                        <Button type="button" size="sm" variant="outline" onClick={() => onStaff(s.id)}>
                                            Staff
                                        </Button>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </section>
                ) : null}

                <section className="flex flex-col gap-2" aria-labelledby="ev-needs">
                    <h3 id="ev-needs" className="text-sm font-semibold">
                        {event ? "Add roles" : "Roles needed"}
                    </h3>
                    {needs.map((need, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <Input
                                aria-label="Role"
                                list="ev-roles"
                                value={need.role}
                                onChange={(e) => setNeeds(needs.map((n, i) => (i === index ? { ...n, role: e.target.value } : n)))}
                            />
                            <Input
                                aria-label="How many"
                                type="number"
                                min={1}
                                max={200}
                                className="w-20"
                                value={need.count}
                                onChange={(e) => setNeeds(needs.map((n, i) => (i === index ? { ...n, count: Math.max(1, Number(e.target.value) || 1) } : n)))}
                            />
                            <Button type="button" variant="ghost" size="icon" aria-label="Remove role" onClick={() => setNeeds(needs.filter((_, i) => i !== index))}>
                                <X />
                            </Button>
                        </div>
                    ))}
                    <datalist id="ev-roles">
                        {roles.map((r) => (
                            <option key={r} value={r} />
                        ))}
                    </datalist>
                    <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setNeeds([...needs, { role: "", count: 1 }])}>
                        <Plus data-icon="inline-start" />
                        Role
                    </Button>
                </section>

                <div className="flex items-center justify-between gap-2 border-t pt-4">
                    {event ? (
                        <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                            <Trash2 data-icon="inline-start" />
                            Delete event
                        </Button>
                    ) : (
                        <span />
                    )}
                    <Button type="submit" disabled={!valid || saving}>
                        {event ? "Save" : "Add event"}
                    </Button>
                </div>
            </form>

            {event ? (
                <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete {event.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                                {eventShifts.length
                                    ? `It has ${eventShifts.length} ${eventShifts.length === 1 ? "shift" : "shifts"}. Keep them as ordinary shifts, or remove them too.`
                                    : "It has no shifts."}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            {eventShifts.length ? (
                                <Button
                                    variant="outline"
                                    onClick={async () => {
                                        setConfirmDelete(false);
                                        const plan = planDeleteEvent(week, event.id, false);
                                        if (plan && (await run(plan))) onClose();
                                    }}
                                >
                                    Keep the shifts
                                </Button>
                            ) : null}
                            <AlertDialogAction
                                onClick={async () => {
                                    const plan = planDeleteEvent(week, event.id, true);
                                    if (plan && (await run(plan))) onClose();
                                }}
                            >
                                {eventShifts.length ? "Delete event and shifts" : "Delete"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            ) : null}
        </>
    );
}
