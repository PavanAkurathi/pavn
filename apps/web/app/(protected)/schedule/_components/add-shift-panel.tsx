"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { SchedulerPerson, SchedulerShift } from "@repo/contracts/scheduler";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@repo/ui/components/ui/sheet";
import { cn } from "@repo/ui/lib/utils";
import { endsNextDay, planAddShift, type AddShiftPrefill } from "@/lib/scheduler/add-shift";
import { rankCandidates } from "@/lib/scheduler/candidates";
import { addDays, formatHours, longDate } from "@/lib/scheduler/format";
import type { Plan } from "@/lib/scheduler/plans";
import { zonedInstant } from "@/lib/scheduler/zoned";
import { ALL_SITES, type Site, type Workspace } from "@/lib/scheduler/workspace";
import { knownRoles } from "@/lib/scheduler/roles";

const PEOPLE_SHOWN = 6;

const minutesBetween = (start: string, end: string) => {
    const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
    const diff = toMinutes(end) - toMinutes(start);
    return diff > 0 ? diff : diff + 24 * 60;
};

/** The shift as it would be, so the same clash rules that guard the grid can answer for it. */
function prospective(input: { siteId: string; localDate: string; startLocal: string; endLocal: string; role: string; capacity: number }, timeZone: string): SchedulerShift {
    const overnight = endsNextDay(input.startLocal, input.endLocal);
    return {
        id: "new-shift",
        locationId: input.siteId,
        dayIndex: -1,
        localDate: input.localDate,
        startLocal: input.startLocal,
        endLocal: input.endLocal,
        overnight,
        startsAt: zonedInstant(input.localDate, input.startLocal, timeZone).toISOString(),
        endsAt: zonedInstant(overnight ? addDays(input.localDate, 1) : input.localDate, input.endLocal, timeZone).toISOString(),
        role: input.role.trim(),
        breakMinutes: 0,
        paidMinutes: minutesBetween(input.startLocal, input.endLocal),
        capacity: input.capacity,
        filled: 0,
        open: input.capacity,
        status: "draft",
        hasUnpublishedEdits: false,
        pendingRemoval: false,
        eventId: null,
        note: null,
        managerNote: null,
        assignees: [],
    };
}

export function AddShiftPanel({
    ws,
    sites,
    scope,
    prefill,
    onClose,
    run,
    onSaved,
}: {
    ws: Workspace;
    /** Every site, not only those in view: a shift can be added anywhere. */
    sites: Site[];
    scope: string;
    /** Null while closed. */
    prefill: AddShiftPrefill | null;
    onClose: () => void;
    run: (plan: Plan) => Promise<boolean>;
    /** The date it was saved on, so the view can go there. */
    onSaved: (localDate: string) => void;
}) {
    return (
        <Sheet open={prefill !== null} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
                {prefill ? <AddShiftForm key={JSON.stringify([prefill.localDate, prefill.siteId, prefill.eventId, prefill.person?.id, prefill.role])} ws={ws} sites={sites} scope={scope} prefill={prefill} onClose={onClose} run={run} onSaved={onSaved} /> : null}
            </SheetContent>
        </Sheet>
    );
}

function AddShiftForm({
    ws,
    sites,
    scope,
    prefill,
    onClose,
    run,
    onSaved,
}: {
    ws: Workspace;
    sites: Site[];
    scope: string;
    prefill: AddShiftPrefill;
    onClose: () => void;
    run: (plan: Plan) => Promise<boolean>;
    onSaved: (localDate: string) => void;
}) {
    const week = ws.week;
    const defaultSite = prefill.siteId ?? (scope !== ALL_SITES ? scope : sites.length === 1 ? sites[0]!.id : "");
    const [siteId, setSiteId] = useState(defaultSite);
    const [localDate, setLocalDate] = useState(prefill.localDate ?? week.days.find((d) => d.isToday)?.localDate ?? week.days[0]!.localDate);
    const [eventName, setEventName] = useState(prefill.eventName ?? "");
    const [role, setRole] = useState(prefill.role ?? prefill.person?.primaryRole ?? "");
    const [startLocal, setStartLocal] = useState(prefill.startLocal ?? "09:00");
    const [endLocal, setEndLocal] = useState(prefill.endLocal ?? "17:00");
    const [capacity, setCapacity] = useState(String(prefill.capacity ?? 1));
    const [chosen, setChosen] = useState<SchedulerPerson[]>(prefill.person ? [prefill.person] : []);
    const [query, setQuery] = useState("");
    const [showAll, setShowAll] = useState(false);
    const [saving, setSaving] = useState(false);

    const roles = useMemo(() => knownRoles(week), [week]);
    const site = sites.find((s) => s.id === siteId);
    const timeZone = ws.weeks.find((w) => w.location.id === siteId)?.location.timezone ?? week.location.timezone;
    const capacityValue = Math.max(1, Math.min(200, Math.floor(Number(capacity)) || 1));
    const overnight = endsNextDay(startLocal, endLocal);
    const timesValid = /^\d{2}:\d{2}$/.test(startLocal) && /^\d{2}:\d{2}$/.test(endLocal) && startLocal !== endLocal;
    const valid = Boolean(siteId) && role.trim() !== "" && /^\d{4}-\d{2}-\d{2}$/.test(localDate) && timesValid;
    // A shift that has already finished can be saved as a draft but never published.
    const [now] = useState(() => Date.now());
    const alreadyEnded =
        timesValid && /^\d{4}-\d{2}-\d{2}$/.test(localDate) && zonedInstant(overnight ? addDays(localDate, 1) : localDate, endLocal, timeZone).getTime() <= now;
    // Conflicts come from the week that is loaded; a date outside it can't be checked here.
    const inLoadedWeek = week.days.some((d) => d.localDate === localDate) || week.days.some((d) => d.localDate === addDays(localDate, 1));
    const eventsThatDay = ws.events.filter((e) => e.locationId === siteId && e.localDate === localDate);

    const candidates = useMemo(() => {
        if (!valid || !inLoadedWeek) return [];
        return rankCandidates(week, prospective({ siteId, localDate, startLocal, endLocal, role, capacity: capacityValue }, timeZone));
    }, [valid, inLoadedWeek, week, siteId, localDate, startLocal, endLocal, role, capacityValue, timeZone]);

    const chosenIds = new Set(chosen.map((p) => p.id));
    const checked = valid && inLoadedWeek;
    const everyone: { person: SchedulerPerson; reasons: string[]; blocked: boolean }[] = checked
        ? candidates.map((c) => ({ person: c.person, reasons: c.reasons, blocked: c.blocked }))
        : week.people.map((person) => ({ person, reasons: [], blocked: false }));
    const needle = query.trim().toLowerCase();
    const matches = everyone.filter((c) => !chosenIds.has(c.person.id) && (!needle || c.person.name.toLowerCase().includes(needle)));
    const shown = showAll || needle ? matches : matches.slice(0, PEOPLE_SHOWN);

    const assessmentFor = (personId: string) => candidates.find((c) => c.person.id === personId);

    const save = async () => {
        if (!valid || saving) return;
        setSaving(true);
        try {
            const plan = planAddShift(
                ws,
                {
                    siteId,
                    localDate,
                    eventName,
                    eventId: prefill.eventId ?? null,
                    role,
                    startLocal,
                    endLocal,
                    capacity: capacityValue,
                    assignees: chosen.map((p) => ({ personId: p.id, kind: p.kind })),
                },
                week.people,
            );
            if (await run(plan)) {
                onSaved(localDate);
                onClose();
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <SheetHeader className="gap-1 border-b p-5 text-left">
                <SheetTitle>Add shift</SheetTitle>
                <SheetDescription>Saved as a draft. Staff see it when you publish.</SheetDescription>
            </SheetHeader>

            <form
                className="flex flex-1 flex-col"
                onSubmit={(event) => {
                    event.preventDefault();
                    void save();
                }}
            >
                <div className="flex flex-col gap-5 p-5">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium" htmlFor="as-date">
                                Date
                            </label>
                            <Input id="as-date" type="date" value={localDate} onChange={(e) => setLocalDate(e.target.value)} />
                            {/^\d{4}-\d{2}-\d{2}$/.test(localDate) ? <span className="text-xs text-muted-foreground">{longDate(localDate)}</span> : null}
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium" htmlFor="as-site">
                                Site
                            </label>
                            <Select value={siteId} onValueChange={setSiteId}>
                                <SelectTrigger id="as-site" className="w-full">
                                    <SelectValue placeholder="Choose a site">{site?.name}</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {sites.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>
                                            {s.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {!siteId ? <span className="text-xs text-muted-foreground">Pick where this happens.</span> : null}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium" htmlFor="as-event">
                            Event or service name <span className="font-normal text-muted-foreground">(optional)</span>
                        </label>
                        <Input id="as-event" list="as-events" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="e.g. Alumni reception" disabled={Boolean(prefill.eventId)} />
                        <datalist id="as-events">
                            {eventsThatDay.map((e) => (
                                <option key={e.id} value={e.name} />
                            ))}
                        </datalist>
                        <span className="text-xs text-muted-foreground">
                            {prefill.eventId ? "Adding a role to this event." : "Leave blank for an ordinary shift. A name that already exists that day at this site adds a role to it."}
                        </span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium" htmlFor="as-role">
                            Role
                        </label>
                        <Input id="as-role" list="as-roles" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Server" maxLength={60} />
                        <datalist id="as-roles">
                            {roles.map((r) => (
                                <option key={r} value={r} />
                            ))}
                        </datalist>
                    </div>

                    <div className="grid grid-cols-[1fr_1fr_6rem] gap-3">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium" htmlFor="as-start">
                                Start
                            </label>
                            <Input id="as-start" type="time" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium" htmlFor="as-end">
                                End
                            </label>
                            <Input id="as-end" type="time" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} aria-invalid={!timesValid} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium" htmlFor="as-capacity">
                                Needed
                            </label>
                            <Input id="as-capacity" type="number" min={1} max={200} inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
                        </div>
                    </div>
                    {timesValid && overnight ? (
                        <p className="-mt-3 text-xs font-medium text-foreground">Ends the next day, {longDate(addDays(localDate, 1))}.</p>
                    ) : !timesValid ? (
                        <p className="-mt-3 text-xs text-destructive">Start and end can&apos;t be the same time.</p>
                    ) : null}
                    {alreadyEnded ? <p className="-mt-3 text-xs font-medium text-amber-700">This time has already passed, so it can be saved as a draft but not published.</p> : null}

                    <section aria-labelledby="as-people" className="flex flex-col gap-2">
                        <div className="flex items-baseline justify-between">
                            <h3 id="as-people" className="text-sm font-semibold">
                                Assigned workers
                            </h3>
                            <span className="text-xs text-muted-foreground">
                                {chosen.length} of {Math.max(capacityValue, chosen.length)} assigned
                                {capacityValue - chosen.length > 0 ? ` · ${capacityValue - chosen.length} left open` : ""}
                            </span>
                        </div>
                        {chosen.length === 0 ? <p className="text-sm text-muted-foreground">Nobody yet. Add people below, or leave every position open.</p> : null}
                        <ul className="flex flex-col">
                            {chosen.map((p) => {
                                const check = assessmentFor(p.id);
                                return (
                                    <li key={p.id} className="flex items-start justify-between gap-2 border-b py-1.5 last:border-b-0">
                                        <span className="min-w-0 text-sm">
                                            <span className="font-medium">{p.name}</span>
                                            {check?.reasons.length ? (
                                                <span className={cn("block text-xs", check.blocked ? "text-destructive" : "text-muted-foreground")}>{check.reasons.join(" · ")}</span>
                                            ) : null}
                                        </span>
                                        <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" aria-label={`Take ${p.name} off`} onClick={() => setChosen((list) => list.filter((x) => x.id !== p.id))}>
                                            <X />
                                        </Button>
                                    </li>
                                );
                            })}
                        </ul>

                        <div className="flex flex-col gap-2 pt-1">
                            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your team" aria-label="Search your team" />
                            {!valid ? (
                                <p className="text-xs text-muted-foreground">Fill in the site, role and times to see who is free.</p>
                            ) : !inLoadedWeek ? (
                                <p className="text-xs text-muted-foreground">This date is outside the week on screen, so availability isn&apos;t shown. Clashes are checked when you save.</p>
                            ) : null}
                            <ul className="flex flex-col">
                                {shown.map((c) => (
                                    <li key={c.person.id} className="flex items-center justify-between gap-2 border-b py-1.5 last:border-b-0">
                                        <span className="min-w-0 text-sm">
                                            <span className="font-medium">{c.person.name}</span>
                                            <span className="text-muted-foreground"> · {c.person.primaryRole ?? "No role"} · {formatHours(c.person.scheduledMinutes)} this week</span>
                                            {checked ? (
                                                <span className={cn("block text-xs", c.blocked ? "text-destructive" : "text-muted-foreground")}>
                                                    {c.reasons.length ? c.reasons.join(" · ") : "Free and trained"}
                                                </span>
                                            ) : null}
                                        </span>
                                        <Button type="button" size="sm" variant={c.blocked ? "ghost" : "outline"} className="shrink-0" onClick={() => setChosen((list) => [...list, c.person])}>
                                            Add
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                            {matches.length === 0 ? <p className="text-xs text-muted-foreground">{needle ? `Nobody matches “${query.trim()}”.` : "Everyone is already on this shift."}</p> : null}
                            {!needle && matches.length > PEOPLE_SHOWN ? (
                                <button type="button" className="w-fit text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => setShowAll(!showAll)}>
                                    {showAll ? "Show fewer" : `Show all ${matches.length}`}
                                </button>
                            ) : null}
                        </div>
                    </section>
                </div>

                <div className="mt-auto flex items-center justify-end gap-2 border-t p-4">
                    <Button type="button" variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={!valid || saving}>
                        Save draft
                    </Button>
                </div>
            </form>
        </>
    );
}
