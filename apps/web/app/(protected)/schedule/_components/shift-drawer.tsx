"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Copy, Lock, OctagonAlert, Trash2, TriangleAlert, X } from "lucide-react";
import type { SchedulerShift, SchedulerShiftPatch, SchedulerWeek } from "@repo/contracts/scheduler";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { Switch } from "@repo/ui/components/ui/switch";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { cn } from "@repo/ui/lib/utils";
import { isLocked } from "@/lib/scheduler/day-model";
import { compactRange, formatHours, weekdayShort } from "@/lib/scheduler/format";
import { formatTimeRange, parseTimeRange } from "@/lib/scheduler/parse-time-range";
import { newShiftId, planAddPerson, planCopyToDays, planTakeOff, staying, type Plan } from "@/lib/scheduler/plans";
import { getShiftTimesheetHref } from "@/lib/routes";
import { knownRoles } from "./add-shift-sheet";
import { PersonAvatar } from "./person-avatar";
import { ResponsiveSheet } from "./responsive-sheet";
import { SuggestList } from "./suggest-list";

function statusText(shift: SchedulerShift) {
    if (shift.pendingRemoval) return "Goes away when you publish";
    if (shift.status === "draft") return "Not shared yet. Your team can't see it.";
    if (shift.hasUnpublishedEdits) return "Shared, with changes your team can't see yet";
    return "Shared with your team";
}

const dayChip =
    "inline-flex h-10 min-w-14 items-center justify-center rounded-full border px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/** One shift: who's on it, who else could be, and its details. Opens from any card or table cell. */
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
        <ResponsiveSheet
            open={shift !== null}
            onOpenChange={(open) => !open && onClose()}
            testId="shift-sheet"
            title={shift ? `${weekdayShort(shift.localDate)} ${compactRange(shift.startLocal, shift.endLocal)} · ${shift.role}` : "Shift"}
            description={shift ? statusText(shift) : undefined}
        >
            {shift ? (
                <ShiftPanel
                    key={`${shift.id}:${shift.startsAt}:${shift.role}:${shift.capacity}`}
                    week={week}
                    shift={shift}
                    run={run}
                    onClose={onClose}
                    onOpenEvent={onOpenEvent}
                />
            ) : null}
        </ResponsiveSheet>
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
    const [saving, setSaving] = useState(false);
    const [copyDays, setCopyDays] = useState<number[]>([]);
    const [keepPeople, setKeepPeople] = useState(true);

    const range = parseTimeRange(time);
    const refs = staying(shift);
    const locked = shift.pendingRemoval || isLocked(shift);
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

    const save = async () => {
        setSaving(true);
        try {
            await run({ changes: [{ op: "update", shiftId: shift.id, patch }], label: `Changed ${label}` });
        } finally {
            setSaving(false);
        }
    };

    const copyPlan = planCopyToDays(week, shift.id, copyDays, { keepPeople: keepPeople && refs.length > 0 });

    return (
        <>
            {locked ? (
                <div className="flex items-start gap-3 rounded-2xl bg-muted px-4 py-3 text-sm">
                    <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
                    <p>
                        {shift.pendingRemoval
                            ? "This shift goes away when you publish."
                            : "This shift has started or is finished, so it changes from its timesheet."}
                    </p>
                </div>
            ) : null}

            {event ? (
                <button
                    type="button"
                    onClick={() => onOpenEvent(event.id)}
                    className="w-fit text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                    ◆ Part of {event.name}
                </button>
            ) : null}

            <section className="flex flex-col gap-2" aria-labelledby="sd-on-shift">
                <h3 id="sd-on-shift" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    On this shift · {shift.filled} of {shift.capacity}
                </h3>
                {shift.assignees.length === 0 ? <p className="px-1 text-sm text-muted-foreground">Nobody yet.</p> : null}
                <ul className="flex flex-col gap-1">
                    {shift.assignees.map((a) => {
                        const person = people.get(a.personId) ?? null;
                        const removed = a.pendingState === "remove";
                        const name = person?.name ?? "Someone no longer on the team";
                        return (
                            <li key={a.personId} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-muted/60">
                                <PersonAvatar person={person} role={shift.role} />
                                <div className="flex min-w-0 flex-1 flex-col">
                                    <span className={cn("truncate text-base font-semibold", removed && "line-through opacity-60")}>
                                        {name}
                                        {a.pendingState === "add" ? <span className="text-sm font-normal text-muted-foreground"> · Not shared yet</span> : null}
                                        {removed ? <span className="text-sm font-normal text-muted-foreground"> · Coming off</span> : null}
                                    </span>
                                    {a.warnings.map((w) => (
                                        <span
                                            key={w.message}
                                            className={cn("flex items-start gap-1.5 text-sm font-medium", w.severity === "block" ? "text-destructive" : "text-warn")}
                                        >
                                            {w.severity === "block" ? (
                                                <OctagonAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                                            ) : (
                                                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                                            )}
                                            {w.message}
                                        </span>
                                    ))}
                                </div>
                                {removed || locked ? null : (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-10 shrink-0 px-3"
                                        aria-label={`Take ${name} off`}
                                        onClick={() => {
                                            const plan = planTakeOff(week, shift.id, a.personId);
                                            if (plan) void run(plan);
                                        }}
                                    >
                                        <X data-icon="inline-start" />
                                        Take off
                                    </Button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </section>

            {locked ? null : (
                <section className="flex flex-col gap-2" aria-labelledby="sd-add">
                    <h3 id="sd-add" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        {shift.open > 0 ? "Who can work this?" : "Add another person"}
                    </h3>
                    <SuggestList
                        week={week}
                        shift={shift}
                        onAdd={(person) => {
                            const plan = planAddPerson(week, shift.id, person);
                            if (plan) void run(plan);
                        }}
                    />
                </section>
            )}

            <form
                className="flex flex-col gap-4"
                aria-labelledby="sd-details"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (dirty && range && !capacityTooLow && !locked) void save();
                }}
            >
                <h3 id="sd-details" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Details
                </h3>
                <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium" htmlFor="sd-day">
                            Day
                        </label>
                        <Select value={dayIndex} onValueChange={setDayIndex} disabled={locked}>
                            <SelectTrigger id="sd-day" className="h-11">
                                <SelectValue>
                                    {weekdayShort(newDate)} {Number(newDate.slice(8))}
                                </SelectValue>
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
                        <label className="text-sm font-medium" htmlFor="sd-time">
                            Time
                        </label>
                        <Input id="sd-time" className="h-11" value={time} disabled={locked} onChange={(e) => setTime(e.target.value)} aria-invalid={!range} />
                        <span className={cn("text-sm", range ? "text-muted-foreground" : "text-destructive")}>
                            {range
                                ? `${formatHours(range.minutes - breakValue)} paid${range.overnight ? ", ends next day" : ""}`
                                : "Try 9-5 or 4p-11p"}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_6rem_6rem] gap-3">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium" htmlFor="sd-role">
                            Role
                        </label>
                        <Input id="sd-role" className="h-11" list="sd-roles" value={role} disabled={locked} onChange={(e) => setRole(e.target.value)} />
                        <datalist id="sd-roles">
                            {roles.map((r) => (
                                <option key={r} value={r} />
                            ))}
                        </datalist>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium" htmlFor="sd-break">
                            Break (min)
                        </label>
                        <Input id="sd-break" className="h-11" type="number" min={0} max={240} step={5} value={breakMinutes} disabled={locked} onChange={(e) => setBreakMinutes(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium" htmlFor="sd-capacity">
                            How many
                        </label>
                        <Input id="sd-capacity" className="h-11" type="number" min={1} max={200} value={capacity} disabled={locked} onChange={(e) => setCapacity(e.target.value)} aria-invalid={capacityTooLow} />
                    </div>
                </div>
                {capacityTooLow ? <p className="-mt-2 text-sm text-destructive">{refs.length} people are on it. Take someone off first.</p> : null}

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium" htmlFor="sd-note">
                        Note to your team
                    </label>
                    <Textarea id="sd-note" rows={2} value={note} disabled={locked} onChange={(e) => setNote(e.target.value)} placeholder="Wear black. Park in the back lot." />
                </div>

                {moreOpen ? (
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium" htmlFor="sd-manager-note">
                            Manager note <span className="font-normal text-muted-foreground">(only managers see it)</span>
                        </label>
                        <Textarea id="sd-manager-note" rows={2} value={managerNote} disabled={locked} onChange={(e) => setManagerNote(e.target.value)} />
                    </div>
                ) : (
                    <button type="button" className="w-fit text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" onClick={() => setMoreOpen(true)}>
                        Add a note only managers see
                    </button>
                )}

                {locked ? null : (
                    <div className="flex justify-end">
                        <Button type="submit" className="h-11 px-6" disabled={!dirty || !range || capacityTooLow || saving}>
                            Save changes
                        </Button>
                    </div>
                )}
            </form>

            {locked ? null : (
                <section className="flex flex-col gap-3" aria-labelledby="sd-copy">
                    <h3 id="sd-copy" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Copy to other days
                    </h3>
                    <div className="flex flex-wrap gap-2" role="group" aria-labelledby="sd-copy">
                        {week.days
                            .filter((d) => d.index !== shift.dayIndex)
                            .map((d) => {
                                const on = copyDays.includes(d.index);
                                return (
                                    <button
                                        key={d.index}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() => setCopyDays((c) => (on ? c.filter((x) => x !== d.index) : [...c, d.index]))}
                                        className={cn(dayChip, on ? "border-secondary bg-secondary text-secondary-foreground" : "bg-card hover:bg-muted")}
                                    >
                                        {weekdayShort(d.localDate)}
                                    </button>
                                );
                            })}
                    </div>
                    {refs.length > 0 ? (
                        <label className="flex items-center gap-3 text-sm">
                            <Switch checked={keepPeople} onCheckedChange={setKeepPeople} />
                            Bring the same {refs.length === 1 ? "person" : "people"}
                        </label>
                    ) : null}
                    <Button
                        type="button"
                        variant="outline"
                        className="h-11 w-fit px-5"
                        disabled={!copyPlan}
                        onClick={async () => {
                            if (copyPlan && (await run(copyPlan))) setCopyDays([]);
                        }}
                    >
                        <Copy data-icon="inline-start" />
                        {copyPlan ? `Copy to ${copyPlan.changes.length} ${copyPlan.changes.length === 1 ? "day" : "days"}` : "Pick the days"}
                    </Button>
                </section>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
                {shift.pendingRemoval ? (
                    <Button
                        type="button"
                        variant="outline"
                        className="h-11"
                        onClick={() => void run({ changes: [{ op: "update", shiftId: shift.id, patch: { cancel: false } }], label: `Kept ${label}` })}
                    >
                        Keep this shift
                    </Button>
                ) : locked ? null : (
                    <>
                        <Button
                            type="button"
                            variant="ghost"
                            className="h-11 text-destructive hover:text-destructive"
                            onClick={async () => {
                                if (await run({ changes: [{ op: "delete", shiftId: shift.id }], label: `Removed ${label} ${shift.role}` })) onClose();
                            }}
                        >
                            <Trash2 data-icon="inline-start" />
                            Remove this shift
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            className="h-11"
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
                                    label: `Added another ${shift.role} spot on ${label}`,
                                })
                            }
                        >
                            <Copy data-icon="inline-start" />
                            Add another spot
                        </Button>
                    </>
                )}
                {shift.status !== "draft" ? (
                    <Button asChild variant="link" className="ml-auto h-11">
                        <Link href={getShiftTimesheetHref(shift.id)}>Open timesheet</Link>
                    </Button>
                ) : null}
            </div>
        </>
    );
}
