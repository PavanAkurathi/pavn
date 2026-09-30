"use client";

import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { SchedulerPerson, SchedulerWeek } from "@repo/contracts/scheduler";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { cn } from "@repo/ui/lib/utils";
import { commonRanges } from "@/lib/scheduler/day-model";
import { compactRange, dayHeading, firstNameOf, formatHours, weekdayShort } from "@/lib/scheduler/format";
import { formatTimeRange, parseTimeRange } from "@/lib/scheduler/parse-time-range";
import { planCreate, type Plan } from "@/lib/scheduler/plans";
import { ResponsiveSheet } from "./responsive-sheet";

export interface AddShiftTarget {
    dayIndex: number;
    /** A person's shift; without one it's an open spot to fill. */
    person: SchedulerPerson | null;
    /** Pre-filled from the row the manager was on. */
    role?: string;
}

/** Every role the business uses: departments first, then anything on the roster or the schedule. */
export function knownRoles(week: SchedulerWeek): string[] {
    const roles = new Set<string>();
    for (const d of week.departments) d.roles.forEach((r) => roles.add(r));
    for (const p of week.people) p.roles.forEach((r) => roles.add(r));
    for (const s of week.shifts) roles.add(s.role);
    return [...roles];
}

const pill = "inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/**
 * "Add a shift": type a time like 9-5, pick a role, and it's a draft. No form
 * to fill in; break, notes and the rest are in the shift's own panel afterwards.
 */
export function AddShiftSheet({
    week,
    target,
    lastRange,
    onClose,
    onCreate,
}: {
    week: SchedulerWeek;
    target: AddShiftTarget | null;
    lastRange: string;
    onClose: () => void;
    onCreate: (plan: Plan, typed: string) => void;
}) {
    return (
        <ResponsiveSheet
            open={target !== null}
            onOpenChange={(open) => !open && onClose()}
            testId="add-shift-sheet"
            focusFirstField
            title="Add a shift"
            description={
                target
                    ? `${target.person ? `${target.person.name} · ` : ""}${dayHeading(week.days[target.dayIndex]!.localDate)}`
                    : undefined
            }
        >
            {target ? (
                <AddShiftForm
                    key={`${target.dayIndex}:${target.person?.id ?? "open"}:${target.role ?? ""}`}
                    week={week}
                    target={target}
                    lastRange={lastRange}
                    onCreate={onCreate}
                />
            ) : null}
        </ResponsiveSheet>
    );
}

function AddShiftForm({
    week,
    target,
    lastRange,
    onCreate,
}: {
    week: SchedulerWeek;
    target: AddShiftTarget;
    lastRange: string;
    onCreate: (plan: Plan, typed: string) => void;
}) {
    const roles = useMemo(() => knownRoles(week), [week]);
    const ranges = useMemo(() => commonRanges(week), [week]);
    const [typed, setTyped] = useState(lastRange);
    const [role, setRole] = useState(target.role ?? target.person?.primaryRole ?? roles[0] ?? "");
    const [count, setCount] = useState(1);
    const [alsoOn, setAlsoOn] = useState<number[]>([]);
    const range = parseTimeRange(typed);
    const ready = Boolean(range && role.trim());

    const submit = () => {
        if (!range || !role.trim()) return;
        const days = [target.dayIndex, ...alsoOn].sort((a, b) => a - b);
        const plans = days.map((dayIndex) =>
            planCreate({
                week,
                dayIndex,
                person: target.person,
                startLocal: range.startLocal,
                endLocal: range.endLocal,
                role: role.trim(),
                capacity: target.person ? 1 : count,
            }),
        );
        const plan: Plan =
            plans.length === 1
                ? plans[0]!
                : {
                      changes: plans.flatMap((p) => p.changes),
                      label: `Added ${compactRange(range.startLocal, range.endLocal)} ${role.trim()} on ${days
                          .map((d) => weekdayShort(week.days[d]!.localDate))
                          .join(", ")}`,
                  };
        onCreate(plan, typed);
    };

    const toggleDay = (index: number) =>
        setAlsoOn((current) => (current.includes(index) ? current.filter((d) => d !== index) : [...current, index]));

    return (
        <form
            className="flex flex-col gap-6"
            onSubmit={(event) => {
                event.preventDefault();
                submit();
            }}
        >
            <div className="flex flex-col gap-2">
                <label htmlFor="add-time" className="text-sm font-semibold">
                    Time
                </label>
                <Input
                    id="add-time"
                    autoFocus
                    value={typed}
                    placeholder="9-5, 4p-11p, 17-23"
                    onChange={(event) => setTyped(event.target.value)}
                    aria-invalid={typed.trim() !== "" && !range}
                    className="h-12 text-base font-medium"
                />
                <p className="min-h-5 text-sm text-muted-foreground" aria-live="polite">
                    {range
                        ? `${compactRange(range.startLocal, range.endLocal)}${range.overnight ? ", ends next day" : ""} · ${formatHours(range.minutes)}`
                        : typed.trim()
                            ? "Try 9-5, 9a-5:30p or 17-23"
                            : ""}
                </p>
                {ranges.length > 0 ? (
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Times you already use">
                        {ranges.map((r) => {
                            const label = compactRange(r.startLocal, r.endLocal);
                            const value = formatTimeRange(r.startLocal, r.endLocal);
                            return (
                                <button
                                    key={label}
                                    type="button"
                                    aria-pressed={typed.trim() === value}
                                    onClick={() => setTyped(value)}
                                    className={cn(pill, typed.trim() === value ? "border-secondary bg-secondary text-secondary-foreground" : "bg-card hover:bg-muted")}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                ) : null}
            </div>

            <div className="flex flex-col gap-2">
                <label htmlFor="add-role" className="text-sm font-semibold">
                    Role
                </label>
                <Input id="add-role" list="add-roles" value={role} onChange={(event) => setRole(event.target.value)} className="h-12 text-base" />
                <datalist id="add-roles">
                    {roles.map((r) => (
                        <option key={r} value={r} />
                    ))}
                </datalist>
                {roles.length > 0 ? (
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Roles">
                        {roles.slice(0, 8).map((r) => (
                            <button
                                key={r}
                                type="button"
                                aria-pressed={role.trim().toLowerCase() === r.toLowerCase()}
                                onClick={() => setRole(r)}
                                className={cn(pill, role.trim().toLowerCase() === r.toLowerCase() ? "border-secondary bg-secondary text-secondary-foreground" : "bg-card hover:bg-muted")}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>

            {target.person ? (
                <p className="rounded-2xl bg-muted px-4 py-3 text-sm">
                    This shift is for <span className="font-semibold">{firstNameOf(target.person.name)}</span>.
                </p>
            ) : (
                <div className="flex flex-col gap-2">
                    <span id="add-count-label" className="text-sm font-semibold">
                        How many people
                    </span>
                    <div className="flex items-center gap-3" role="group" aria-labelledby="add-count-label">
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-11"
                            aria-label="Fewer people"
                            disabled={count <= 1}
                            onClick={() => setCount((c) => Math.max(1, c - 1))}
                        >
                            <Minus />
                        </Button>
                        <span className="w-8 text-center text-xl font-semibold tabular-nums" aria-live="polite">
                            {count}
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-11"
                            aria-label="More people"
                            disabled={count >= 50}
                            onClick={() => setCount((c) => Math.min(50, c + 1))}
                        >
                            <Plus />
                        </Button>
                        <span className="text-sm text-muted-foreground">Left open until you fill it.</span>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-2">
                <span id="add-also-label" className="text-sm font-semibold">
                    Also add on
                </span>
                <div className="flex flex-wrap gap-2" role="group" aria-labelledby="add-also-label">
                    {week.days
                        .filter((d) => d.index !== target.dayIndex)
                        .map((d) => (
                            <button
                                key={d.index}
                                type="button"
                                aria-pressed={alsoOn.includes(d.index)}
                                onClick={() => toggleDay(d.index)}
                                className={cn(pill, "min-w-14 justify-center", alsoOn.includes(d.index) ? "border-secondary bg-secondary text-secondary-foreground" : "bg-card hover:bg-muted")}
                            >
                                {weekdayShort(d.localDate)}
                            </button>
                        ))}
                </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t pt-4">
                <span className="text-sm text-muted-foreground">Stays with you until you publish.</span>
                <Button type="submit" className="h-11 px-6" disabled={!ready}>
                    Add
                </Button>
            </div>
        </form>
    );
}
