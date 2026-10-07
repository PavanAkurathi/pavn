"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Copy, Trash2, UserPlus, X } from "lucide-react";
import type { SchedulerChange, SchedulerShift, SchedulerShiftPatch, SchedulerWeek } from "@repo/contracts/scheduler";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@repo/ui/components/ui/sheet";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { cn } from "@repo/ui/lib/utils";
import { rankCandidates } from "@/lib/scheduler/candidates";
import { compactRange, formatHours, weekdayShort } from "@/lib/scheduler/format";
import { formatTimeRange, parseTimeRange } from "@/lib/scheduler/parse-time-range";
import { newShiftId, staying, type Plan } from "@/lib/scheduler/plans";
import { getShiftTimesheetHref } from "@/lib/routes";
import { knownRoles } from "@/lib/scheduler/roles";

const CANDIDATES_SHOWN = 8;

function statusText(shift: SchedulerShift) {
    if (shift.pendingRemoval) return "Removed when you publish";
    if (shift.status === "draft") return "Draft · staff can't see it yet";
    if (shift.hasUnpublishedEdits) return "Published · has changes staff can't see yet";
    return "Published";
}

export function ShiftDrawer({
    week,
    shiftId,
    onClose,
    run,
    onOpenEvent,
}: {
    week: SchedulerWeek;
    shiftId: string | null;
    onClose: () => void;
    run: (plan: Plan) => Promise<boolean>;
    onOpenEvent: (eventId: string) => void;
}) {
    const shift = shiftId ? week.shifts.find((s) => s.id === shiftId) ?? null : null;
    return (
        <Sheet open={shift !== null} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
                {shift ? <ShiftPanel key={`${shift.id}:${shift.startsAt}:${shift.role}:${shift.capacity}`} week={week} shift={shift} run={run} onClose={onClose} onOpenEvent={onOpenEvent} /> : null}
            </SheetContent>
        </Sheet>
    );
}

function ShiftPanel({
    week,
    shift,
    run,
    onClose,
    onOpenEvent,
}: {
    week: SchedulerWeek;
    shift: SchedulerShift;
    run: (plan: Plan) => Promise<boolean>;
    onClose: () => void;
    onOpenEvent: (eventId: string) => void;
}) {
    const people = useMemo(() => new Map(week.people.map((p) => [p.id, p])), [week.people]);
    const roles = useMemo(() => knownRoles(week), [week]);
    const [dayIndex, setDayIndex] = useState(String(shift.dayIndex));
    const [time, setTime] = useState(formatTimeRange(shift.startLocal, shift.endLocal));
    const [role, setRole] = useState(shift.role);
    const [breakMinutes, setBreakMinutes] = useState(String(shift.breakMinutes));
    const [capacity, setCapacity] = useState(String(shift.capacity));
    const [note, setNote] = useState(shift.note ?? "");
    const [managerNote, setManagerNote] = useState(shift.managerNote ?? "");
    const [moreOpen, setMoreOpen] = useState(Boolean(shift.managerNote));
    const [showAll, setShowAll] = useState(false);
    const [saving, setSaving] = useState(false);

    const range = parseTimeRange(time);
    const refs = staying(shift);
    const candidates = useMemo(() => rankCandidates(week, shift), [week, shift]);
    const locked = shift.pendingRemoval;
    const event = shift.eventId ? week.events.find((e) => e.id === shift.eventId) ?? null : null;

    const patch: SchedulerShiftPatch = {};
    const newDate = week.days[Number(dayIndex)]!.localDate;
    if (newDate !== shift.localDate) patch.localDate = newDate;
    if (range && range.startLocal !== shift.startLocal) patch.startLocal = range.startLocal;
    if (range && range.endLocal !== shift.endLocal) patch.endLocal = range.endLocal;
    if (role.trim() && role.trim() !== shift.role) patch.role = role.trim();
    const breakValue = Math.max(0, Math.min(240, Number(breakMinutes) || 0));
    if (breakValue !== shift.breakMinutes) patch.breakMinutes = breakValue;
    const capacityValue = Math.max(1, Math.min(200, Number(capacity) || 1));
    if (capacityValue !== shift.capacity) patch.capacity = capacityValue;
    if ((note.trim() || null) !== (shift.note ?? null)) patch.note = note.trim() || null;
    if ((managerNote.trim() || null) !== (shift.managerNote ?? null)) patch.managerNote = managerNote.trim() || null;
    const dirty = Object.keys(patch).length > 0;
    const capacityTooLow = capacityValue < refs.length;

    const label = `${weekdayShort(shift.localDate)} ${compactRange(shift.startLocal, shift.endLocal)}`;
    // After a save the shift is where the manager just put it, so the message names that, not the old slot.
    const savedLabel = `${weekdayShort(newDate)} ${compactRange(patch.startLocal ?? shift.startLocal, patch.endLocal ?? shift.endLocal)}`;

    const save = async () => {
        setSaving(true);
        try {
            await run({ changes: [{ op: "update", shiftId: shift.id, patch }], label: `Changed ${savedLabel}` });
        } finally {
            setSaving(false);
        }
    };

    const setPeople = (next: typeof refs, text: string) => {
        const changes: SchedulerChange[] = [];
        if (next.length > shift.capacity) changes.push({ op: "update", shiftId: shift.id, patch: { capacity: next.length } });
        changes.push({ op: "assign", shiftId: shift.id, assignees: next });
        void run({ changes, label: text });
    };

    const shown = showAll ? candidates : candidates.slice(0, CANDIDATES_SHOWN);

    return (
        <>
            <SheetHeader className="gap-1 border-b p-5 text-left">
                <SheetTitle className="flex items-center justify-between gap-3">
                    <span>
                        {label} · {shift.role}
                    </span>
                    <Badge variant={shift.open > 0 ? "destructive" : "secondary"}>
                        {shift.filled}/{shift.capacity}
                    </Badge>
                </SheetTitle>
                <SheetDescription>{statusText(shift)}</SheetDescription>
                {event ? (
                    <button
                        type="button"
                        onClick={() => onOpenEvent(event.id)}
                        className="w-fit text-sm font-medium text-primary underline-offset-2 hover:underline"
                    >
                        <span aria-hidden>◆ </span>
                        {event.name}
                    </button>
                ) : null}
            </SheetHeader>

            <div className="flex flex-col gap-6 p-5">
                <form
                    className="flex flex-col gap-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (dirty && range && !capacityTooLow) void save();
                    }}
                >
                    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium" htmlFor="sd-day">
                                Day
                            </label>
                            <Select value={dayIndex} onValueChange={setDayIndex} disabled={locked}>
                                <SelectTrigger id="sd-day">
                                    <SelectValue>{weekdayShort(newDate)}</SelectValue>
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
                            <label className="text-xs font-medium" htmlFor="sd-time">
                                Time
                            </label>
                            <Input id="sd-time" value={time} disabled={locked} onChange={(e) => setTime(e.target.value)} aria-invalid={!range} />
                            <span className={cn("text-xs", range ? "text-muted-foreground" : "text-destructive")}>
                                {range
                                    ? `${formatHours(range.minutes - breakValue)} paid${range.overnight ? ", ends next day" : ""}`
                                    : "Try 9-5 or 4p-11p"}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] gap-3">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium" htmlFor="sd-role">
                                Role
                            </label>
                            <Input id="sd-role" list="sd-roles" value={role} disabled={locked} onChange={(e) => setRole(e.target.value)} />
                            <datalist id="sd-roles">
                                {roles.map((r) => (
                                    <option key={r} value={r} />
                                ))}
                            </datalist>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium" htmlFor="sd-break">
                                Break (min)
                            </label>
                            <Input id="sd-break" type="number" min={0} max={240} step={5} value={breakMinutes} disabled={locked} onChange={(e) => setBreakMinutes(e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium" htmlFor="sd-capacity">
                                How many
                            </label>
                            <Input id="sd-capacity" type="number" min={1} max={200} value={capacity} disabled={locked} onChange={(e) => setCapacity(e.target.value)} aria-invalid={capacityTooLow} />
                        </div>
                    </div>
                    {capacityTooLow ? <p className="-mt-2 text-xs text-destructive">{refs.length} people are on it; take someone off first.</p> : null}

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium" htmlFor="sd-note">
                            Note to staff
                        </label>
                        <Textarea id="sd-note" rows={2} value={note} disabled={locked} onChange={(e) => setNote(e.target.value)} placeholder="Wear black. Park in the back lot." />
                    </div>

                    {moreOpen ? (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium" htmlFor="sd-manager-note">
                                Manager note <span className="font-normal text-muted-foreground">(only managers see it)</span>
                            </label>
                            <Textarea id="sd-manager-note" rows={2} value={managerNote} disabled={locked} onChange={(e) => setManagerNote(e.target.value)} />
                        </div>
                    ) : (
                        <button type="button" className="w-fit text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => setMoreOpen(true)}>
                            More: manager note
                        </button>
                    )}

                    {locked ? null : (
                        <div className="flex justify-end">
                            <Button type="submit" disabled={!dirty || !range || capacityTooLow || saving}>
                                Save changes
                            </Button>
                        </div>
                    )}
                </form>

                <section className="flex flex-col gap-2" aria-labelledby="sd-on-shift">
                    <h3 id="sd-on-shift" className="text-sm font-semibold">
                        On this shift
                    </h3>
                    {refs.length === 0 ? <p className="text-sm text-muted-foreground">Nobody yet.</p> : null}
                    <ul className="flex flex-col gap-1">
                        {shift.assignees.map((a) => {
                            const person = people.get(a.personId);
                            const removed = a.pendingState === "remove";
                            return (
                                <li key={a.personId} className="flex items-start justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60">
                                    <div className="flex min-w-0 flex-col">
                                        <span className={cn("truncate text-sm font-medium", removed && "line-through opacity-60")}>
                                            {person?.name ?? "Someone no longer on the team"}
                                            {a.pendingState === "add" ? <span className="font-normal text-muted-foreground"> · not published yet</span> : null}
                                            {removed ? <span className="font-normal text-muted-foreground"> · coming off</span> : null}
                                        </span>
                                        {a.warnings.map((w) => (
                                            <span key={w.message} className={cn("text-xs", w.severity === "block" ? "text-destructive" : "text-amber-700")}>
                                                {w.message}
                                            </span>
                                        ))}
                                    </div>
                                    {removed || locked ? null : (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="size-7 shrink-0"
                                            aria-label={`Take ${person?.name ?? "them"} off`}
                                            onClick={() => setPeople(refs.filter((r) => r.personId !== a.personId), `Took ${person?.name.split(" ")[0] ?? "someone"} off ${label}`)}
                                        >
                                            <X />
                                        </Button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </section>

                {locked ? null : (
                    <section className="flex flex-col gap-2" aria-labelledby="sd-candidates">
                        <h3 id="sd-candidates" className="text-sm font-semibold">
                            Who can take it
                        </h3>
                        <ul className="flex flex-col gap-1">
                            {shown.map((c) => (
                                <li key={c.person.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60">
                                    <div className="flex min-w-0 flex-col">
                                        <span className="truncate text-sm font-medium">
                                            {c.person.name}
                                            <span className="font-normal text-muted-foreground"> · {formatHours(c.person.scheduledMinutes)}</span>
                                        </span>
                                        {c.reasons.length ? (
                                            <span className={cn("truncate text-xs", c.blocked ? "text-destructive" : "text-muted-foreground")}>{c.reasons.join(" · ")}</span>
                                        ) : (
                                            <span className="text-xs text-emerald-700">Free and trained</span>
                                        )}
                                    </div>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={c.blocked ? "ghost" : "outline"}
                                        className="shrink-0"
                                        onClick={() =>
                                            setPeople([...refs, { personId: c.person.id }], `Added ${c.person.name.split(" ")[0]} to ${label}`)
                                        }
                                    >
                                        <UserPlus data-icon="inline-start" />
                                        Add
                                    </Button>
                                </li>
                            ))}
                        </ul>
                        {candidates.length === 0 ? <p className="text-sm text-muted-foreground">No one else to add.</p> : null}
                        {candidates.length > CANDIDATES_SHOWN ? (
                            <button type="button" className="w-fit text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => setShowAll(!showAll)}>
                                {showAll ? "Show fewer" : `Show all ${candidates.length}`}
                            </button>
                        ) : null}
                    </section>
                )}
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-2 border-t p-4">
                {shift.pendingRemoval ? (
                    <Button type="button" variant="outline" onClick={() => void run({ changes: [{ op: "update", shiftId: shift.id, patch: { cancel: false } }], label: `Kept ${label}` })}>
                        Keep this shift
                    </Button>
                ) : (
                    <>
                        <Button
                            type="button"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={async () => {
                                if (await run({ changes: [{ op: "delete", shiftId: shift.id }], label: `Deleted ${label} ${shift.role}` })) onClose();
                            }}
                        >
                            <Trash2 data-icon="inline-start" />
                            {shift.status === "draft" ? "Delete" : "Remove"}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() =>
                                void run({
                                    changes: [
                                        {
                                            op: "create",
                                            shiftId: newShiftId(),
                                            shift: {
                                                locationId: shift.locationId,
                                                localDate: shift.localDate,
                                                startLocal: shift.startLocal,
                                                endLocal: shift.endLocal,
                                                role: shift.role,
                                                capacity: shift.capacity,
                                                breakMinutes: shift.breakMinutes,
                                                note: shift.note,
                                            },
                                            assignees: [],
                                        },
                                    ],
                                    label: `Duplicated ${label} as open`,
                                })
                            }
                        >
                            <Copy data-icon="inline-start" />
                            Duplicate
                        </Button>
                    </>
                )}
                {shift.status !== "draft" ? (
                    <Button asChild variant="link" className="ml-auto">
                        <Link href={getShiftTimesheetHref(shift.id)}>Open timesheet</Link>
                    </Button>
                ) : null}
            </div>
        </>
    );
}
