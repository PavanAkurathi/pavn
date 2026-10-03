"use client";

import { useMemo, useState } from "react";
import type { SchedulerPerson, SchedulerWeek } from "@repo/contracts/scheduler";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@repo/ui/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { compactRange, formatHours, weekdayShort } from "@/lib/scheduler/format";
import { parseTimeRange } from "@/lib/scheduler/parse-time-range";
import { planCreate, type Plan } from "@/lib/scheduler/plans";

export interface QuickCreateTarget {
    anchor: HTMLElement;
    dayIndex: number;
    person: SchedulerPerson | null;
    /** Pre-filled from the Positions row clicked. */
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

const OPEN = "open";

/**
 * Click an empty cell, type "9-5", press Enter. Time, role and who: break and
 * notes live in the shift panel, which is also where candidates are ranked.
 */
export function QuickCreate({
    week,
    target,
    lastRange,
    onClose,
    onCreate,
}: {
    week: SchedulerWeek;
    target: QuickCreateTarget | null;
    lastRange: string;
    onClose: () => void;
    onCreate: (plan: Plan, typed: string) => void;
}) {
    return (
        <Popover open={target !== null} onOpenChange={(open) => !open && onClose()}>
            {target ? <PopoverAnchor virtualRef={{ current: target.anchor }} /> : null}
            <PopoverContent align="start" side="bottom" className="w-72 gap-3 p-3">
                {target ? (
                    <QuickCreateForm key={`${target.dayIndex}-${target.person?.id ?? "open"}`} week={week} target={target} lastRange={lastRange} onCreate={onCreate} />
                ) : null}
            </PopoverContent>
        </Popover>
    );
}

function QuickCreateForm({
    week,
    target,
    lastRange,
    onCreate,
}: {
    week: SchedulerWeek;
    target: QuickCreateTarget;
    lastRange: string;
    onCreate: (plan: Plan, typed: string) => void;
}) {
    const roles = useMemo(() => knownRoles(week), [week]);
    const [typed, setTyped] = useState(lastRange);
    const [role, setRole] = useState(target.role ?? target.person?.primaryRole ?? roles[0] ?? "");
    const [roleTouched, setRoleTouched] = useState(Boolean(target.role));
    // Who: the row you clicked on a person's row, "leave open" on a role's row.
    const [who, setWho] = useState<string>(target.person?.id ?? OPEN);
    const [count, setCount] = useState(1);
    const range = parseTimeRange(typed);
    const day = weekdayShort(week.days[target.dayIndex]!.localDate);
    const person = who === OPEN ? null : (week.people.find((p) => p.id === who) ?? null);

    // People who do this role first; everyone else is still there for covering a gap.
    const { fits, others } = useMemo(() => {
        const wanted = role.trim().toLowerCase();
        const byName = (a: SchedulerPerson, b: SchedulerPerson) => a.name.localeCompare(b.name);
        const fits = week.people.filter((p) => wanted && p.roles.some((r) => r.toLowerCase() === wanted)).sort(byName);
        const fitIds = new Set(fits.map((p) => p.id));
        return { fits, others: week.people.filter((p) => !fitIds.has(p.id)).sort(byName) };
    }, [week.people, role]);

    const pick = (id: string) => {
        setWho(id);
        // Choosing someone on a person's row follows their role, until the role has been set by hand.
        const chosen = week.people.find((p) => p.id === id);
        if (chosen?.primaryRole && !roleTouched) setRole(chosen.primaryRole);
    };

    const submit = () => {
        if (!range || !role.trim()) return;
        onCreate(
            planCreate({
                week,
                dayIndex: target.dayIndex,
                person,
                startLocal: range.startLocal,
                endLocal: range.endLocal,
                role: role.trim(),
                capacity: person ? 1 : count,
            }),
            typed,
        );
    };

    return (
        <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
                event.preventDefault();
                submit();
            }}
        >
            <p className="text-xs font-semibold">
                New shift · {role.trim() || "No role yet"} · {day}
            </p>
            <div className="flex flex-col gap-1">
                <label htmlFor="qc-who" className="text-xs font-medium">
                    Team member
                </label>
                <Select value={who} onValueChange={pick}>
                    <SelectTrigger id="qc-who" className="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={OPEN}>Leave open</SelectItem>
                        {fits.length > 0 ? (
                            <SelectGroup>
                                <SelectLabel>{role.trim()}</SelectLabel>
                                {fits.map((p) => (
                                    <PersonOption key={p.id} person={p} />
                                ))}
                            </SelectGroup>
                        ) : null}
                        {others.length > 0 ? (
                            <SelectGroup>
                                <SelectLabel>{fits.length > 0 ? "Everyone else" : "Team"}</SelectLabel>
                                {others.map((p) => (
                                    <PersonOption key={p.id} person={p} />
                                ))}
                            </SelectGroup>
                        ) : null}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex flex-col gap-1">
                <label htmlFor="qc-time" className="text-xs font-medium">
                    Time
                </label>
                <Input
                    id="qc-time"
                    autoFocus
                    value={typed}
                    placeholder="9-5, 4p-11p, 17-23"
                    onChange={(event) => setTyped(event.target.value)}
                    aria-invalid={typed.trim() !== "" && !range}
                    className="font-medium"
                />
                <p className="min-h-4 text-xs text-muted-foreground" aria-live="polite">
                    {range
                        ? `${compactRange(range.startLocal, range.endLocal)}${range.overnight ? ", ends next day" : ""} · ${formatHours(range.minutes)}`
                        : typed.trim()
                            ? "Try 9-5, 9a-5:30p or 17-23"
                            : ""}
                </p>
            </div>
            <div className="flex gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <label htmlFor="qc-role" className="text-xs font-medium">
                        Role
                    </label>
                    <Input
                        id="qc-role"
                        list="qc-roles"
                        value={role}
                        onChange={(event) => {
                            setRole(event.target.value);
                            setRoleTouched(true);
                        }}
                    />
                    <datalist id="qc-roles">
                        {roles.map((r) => (
                            <option key={r} value={r} />
                        ))}
                    </datalist>
                </div>
                {person ? null : (
                    <div className="flex w-20 flex-col gap-1">
                        <label htmlFor="qc-count" className="text-xs font-medium">
                            How many
                        </label>
                        <Input
                            id="qc-count"
                            type="number"
                            min={1}
                            max={50}
                            value={count}
                            onChange={(event) => setCount(Math.max(1, Math.min(50, Number(event.target.value) || 1)))}
                        />
                    </div>
                )}
            </div>
            <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">Saves as a draft</span>
                <Button type="submit" size="sm" disabled={!range || !role.trim()}>
                    Add
                </Button>
            </div>
        </form>
    );
}

function PersonOption({ person }: { person: SchedulerPerson }) {
    return (
        <SelectItem value={person.id}>
            {person.name}
            <span className="ml-1.5 text-muted-foreground">
                {person.primaryRole ? `${person.primaryRole} · ` : ""}
                {formatHours(person.scheduledMinutes)}
            </span>
        </SelectItem>
    );
}
