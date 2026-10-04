"use client";

import { useMemo, useState } from "react";
import { Ban, Search, TriangleAlert, X } from "lucide-react";
import type { SchedulerShift } from "@repo/contracts/scheduler";
import { InitialsAvatar } from "@repo/ui/components/app/initials-avatar";
import { Button } from "@repo/ui/components/ui/button";
import { roleHue } from "@repo/ui/lib/role-hue";
import { cn } from "@repo/ui/lib/utils";
import { rankCandidates } from "@/lib/scheduler/candidates";
import { clockRange, shortDate } from "@/lib/scheduler/format";
import { staying, type Plan } from "@/lib/scheduler/plans";
import type { Workspace } from "@/lib/scheduler/workspace";

/**
 * Who could fill one position, next to the day it is on. Search by name; each
 * person says in words whether they are free or what clashes. Choosing someone
 * is always a click on Assign; a clash still asks first (and is audited), it
 * never happens on its own.
 */
export function AssignPanel({
    ws,
    shift,
    title,
    run,
    onClose,
}: {
    ws: Workspace;
    shift: SchedulerShift;
    /** The event or service the position belongs to. */
    title: string;
    run: (plan: Plan) => Promise<boolean>;
    onClose: () => void;
}) {
    const [query, setQuery] = useState("");
    const [busy, setBusy] = useState<string | null>(null);
    const week = ws.week;
    const candidates = useMemo(() => rankCandidates(week, shift), [week, shift]);
    const needle = query.trim().toLowerCase();
    const shown = candidates.filter((c) => !needle || c.person.name.toLowerCase().includes(needle));
    const siteName = ws.sites.length > 1 ? ws.sites.find((s) => s.id === shift.locationId)?.name : undefined;

    const assign = async (personId: string) => {
        const candidate = candidates.find((c) => c.person.id === personId);
        if (!candidate || busy) return;
        setBusy(personId);
        try {
            const refs = [...staying(shift), { personId, kind: candidate.person.kind }];
            await run({
                changes: [
                    ...(refs.length > shift.capacity ? [{ op: "update" as const, shiftId: shift.id, patch: { capacity: refs.length } }] : []),
                    { op: "assign" as const, shiftId: shift.id, assignees: refs },
                ],
                label: `Added ${candidate.person.name.split(" ")[0]} to ${shift.role}, ${shortDate(shift.localDate)}`,
            });
        } finally {
            setBusy(null);
        }
    };

    return (
        <aside aria-label={`Assign ${shift.role}`} className="flex max-h-[calc(100vh-12rem)] flex-col rounded-2xl border bg-card p-5 lg:sticky lg:top-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-[22px] font-semibold leading-tight">Assign {shift.role.toLowerCase()}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {title} · {shortDate(shift.localDate)} · {clockRange(shift.startLocal, shift.endLocal)}
                        {shift.overnight ? " +1" : ""}
                        {siteName ? ` · ${siteName}` : ""}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{shift.open === 0 ? "Every position is filled." : `${shift.open} of ${shift.capacity} still ${shift.status === "draft" ? "unfilled" : "open for pickup"}.`}</p>
                </div>
                <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Close" onClick={onClose}>
                    <X />
                </Button>
            </div>

            <div className="relative mt-4">
                <Search aria-hidden className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Find a team member"
                    aria-label="Find a team member"
                    className="h-10 w-full rounded-lg border bg-card pl-9 pr-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
                />
            </div>

            <ul className="mt-2 flex-1 overflow-y-auto">
                {shown.map((c) => {
                    const clash = c.reasons.length > 0;
                    return (
                        <li key={c.person.id} className="flex items-center gap-3 border-b py-3 last:border-b-0">
                            <InitialsAvatar name={c.person.name} size="lg" tone="soft" hue={roleHue(c.person.primaryRole)} className={cn(c.blocked && "opacity-60")} />
                            <div className={cn("min-w-0 flex-1", c.blocked && "text-muted-foreground")}>
                                <p className="truncate text-[15px] font-semibold">{c.person.name}</p>
                                <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                                    {clash ? (
                                        <>
                                            {c.blocked ? <Ban aria-hidden className="size-3.5 shrink-0" /> : <TriangleAlert aria-hidden className="size-3.5 shrink-0 text-amber-600" />}
                                            <span className="truncate">{c.reasons.join(" · ")}</span>
                                        </>
                                    ) : (
                                        <>
                                            <span aria-hidden className="size-2 shrink-0 rounded-full bg-emerald-500" />
                                            <span className="truncate">Available · {c.person.primaryRole ?? "No role set"}</span>
                                        </>
                                    )}
                                </p>
                            </div>
                            <Button
                                variant={c.blocked ? "ghost" : "outline"}
                                size="sm"
                                className={cn("shrink-0 font-semibold", !c.blocked && "border-primary/40 text-primary hover:bg-primary/5 hover:text-primary")}
                                disabled={busy !== null}
                                onClick={() => void assign(c.person.id)}
                            >
                                {c.blocked ? "Assign anyway" : "Assign"}
                            </Button>
                        </li>
                    );
                })}
                {shown.length === 0 ? <li className="py-8 text-center text-sm text-muted-foreground">{needle ? `Nobody matches “${query.trim()}”.` : "Everyone is already on this shift."}</li> : null}
            </ul>
        </aside>
    );
}
