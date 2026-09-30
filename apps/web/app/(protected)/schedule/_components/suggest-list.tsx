"use client";

import { useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import type { SchedulerPerson, SchedulerShift, SchedulerWeek } from "@repo/contracts/scheduler";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { cn } from "@repo/ui/lib/utils";
import { groupCandidates, rankCandidates, type Candidate } from "@/lib/scheduler/candidates";
import { formatHours } from "@/lib/scheduler/format";
import { PersonAvatar } from "./person-avatar";

const SHOWN_AT_FIRST = 6;

function Row({ candidate, onAdd, busy }: { candidate: Candidate; onAdd: (person: SchedulerPerson) => void; busy: boolean }) {
    const { person, blocked, reasons } = candidate;
    return (
        <li className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-muted/60">
            <PersonAvatar person={person} />
            <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-base font-semibold">{person.name}</span>
                <span className="text-sm">
                    <span className="text-muted-foreground">{formatHours(person.scheduledMinutes)} this week · </span>
                    <span className={cn(blocked ? "font-medium text-destructive" : reasons.length ? "text-warn" : "text-ok")}>
                        {reasons.length ? reasons.join(" · ") : "Free and knows the role"}
                    </span>
                </span>
            </div>
            <Button
                type="button"
                size="sm"
                variant={blocked ? "ghost" : "outline"}
                className="h-10 shrink-0 px-4"
                disabled={busy}
                data-testid={`suggest-add-${person.id}`}
                aria-label={`Add ${person.name}`}
                onClick={() => onAdd(person)}
            >
                <UserPlus data-icon="inline-start" />
                Add
            </Button>
        </li>
    );
}

function Group({
    title,
    hint,
    rows,
    onAdd,
    busy,
}: {
    title: string;
    hint?: string;
    rows: Candidate[];
    onAdd: (person: SchedulerPerson) => void;
    busy: boolean;
}) {
    if (rows.length === 0) return null;
    return (
        <section className="flex flex-col gap-1">
            <h3 className="px-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {title}
                {hint ? <span className="ml-2 font-normal normal-case tracking-normal">{hint}</span> : null}
            </h3>
            <ul className="flex flex-col">
                {rows.map((c) => (
                    <Row key={c.person.id} candidate={c} onAdd={onAdd} busy={busy} />
                ))}
            </ul>
        </section>
    );
}

/**
 * Who could work this shift, in three piles: a good fit, worth a look, and
 * can't work then. Every line says why, in words.
 */
export function SuggestList({
    week,
    shift,
    onAdd,
    busy = false,
}: {
    week: SchedulerWeek;
    shift: SchedulerShift;
    onAdd: (person: SchedulerPerson) => void;
    busy?: boolean;
}) {
    const [query, setQuery] = useState("");
    const [everyone, setEveryone] = useState(false);
    const ranked = useMemo(() => rankCandidates(week, shift), [week, shift]);

    const q = query.trim().toLowerCase();
    const matching = q ? ranked.filter((c) => c.person.name.toLowerCase().includes(q)) : ranked;
    // Until asked for, show the best few; a search or "Show everyone" lifts the limit.
    const capped = !everyone && !q && matching.length > SHOWN_AT_FIRST;
    const visible = capped ? matching.slice(0, SHOWN_AT_FIRST) : matching;
    const groups = groupCandidates(visible);

    return (
        <div className="flex flex-col gap-3" data-testid="suggest-list">
            {ranked.length > SHOWN_AT_FIRST ? (
                <Input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Find someone by name"
                    aria-label="Find someone by name"
                    className="h-11"
                />
            ) : null}
            {ranked.length === 0 ? (
                <p className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                    Nobody else is on the team yet. Add people in Roster.
                </p>
            ) : matching.length === 0 ? (
                <p className="px-2 text-sm text-muted-foreground">Nobody matches &ldquo;{query.trim()}&rdquo;.</p>
            ) : (
                <>
                    <Group title="Good fit" rows={groups.good} onAdd={onAdd} busy={busy} />
                    <Group title="Worth a look" rows={groups.maybe} onAdd={onAdd} busy={busy} />
                    <Group title="Can't work then" hint="You can still add them" rows={groups.blocked} onAdd={onAdd} busy={busy} />
                </>
            )}
            {capped ? (
                <button
                    type="button"
                    className="w-fit px-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
                    onClick={() => setEveryone(true)}
                >
                    Show everyone ({matching.length})
                </button>
            ) : null}
        </div>
    );
}
