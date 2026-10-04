"use client";

import * as React from "react";
import useSWR from "swr";
import { parseISO, format } from "date-fns";
import { Search } from "lucide-react";

import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { Input } from "@repo/ui/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@repo/ui/components/ui/sheet";
import { useCrewData } from "@/hooks/use-crew-data";
import { rankCandidates } from "@/lib/scheduler/candidates";
import { fetchSchedulerWeek, weekKey } from "@/lib/scheduler/client";
import { getLocalParts } from "@/lib/shifts/shift-time";
import type { Shift } from "@/lib/types";
import type { AddWorkerSelection } from "./add-worker-dialog";

interface WorkerPickerSheetProps {
    isOpen: boolean;
    onClose: () => void;
    shift: Shift;
    /** Called with the one person tapped; the sheet closes itself first. */
    onPick: (worker: AddWorkerSelection) => Promise<void> | void;
    /** People already on the shift are not offered. */
    existingWorkerIds?: string[];
    /** Opens the agency / temp flow, which the roster picker doesn't cover. */
    onAddTemps?: () => void;
}

/**
 * Add someone to a shift in one tap.
 *
 * Search, filter by role, tap a name. A person with a clash shows it beside
 * their name ("Already on Wed 4p-11p") but can still be picked: the manager
 * usually has a reason, and the warning comes back with the confirmation.
 * The clashes are the Scheduler's own (double-booked, time off, unavailable),
 * read off that shift's week, so both screens agree on who is free.
 */
export function WorkerPickerSheet({
    isOpen,
    onClose,
    shift,
    onPick,
    existingWorkerIds = [],
    onAddTemps,
}: WorkerPickerSheetProps) {
    const { crew, isLoading } = useCrewData();
    const [query, setQuery] = React.useState("");
    const [role, setRole] = React.useState("All");

    // The week the shift sits in, for who is free. Without it the list still works, just unlabelled.
    const localDate = getLocalParts(parseISO(shift.startTime), shift.timezone).date;
    const { data: week } = useSWR(
        isOpen && shift.locationId ? weekKey(shift.locationId, localDate) : null,
        fetchSchedulerWeek,
    );

    const assessed = React.useMemo(() => {
        const schedulerShift = week?.shifts.find((s) => s.id === shift.id);
        if (!week || !schedulerShift) return null;
        return new Map(rankCandidates(week, schedulerShift).map((c, rank) => [c.person.id, { ...c, rank }]));
    }, [week, shift.id]);

    const roles = React.useMemo(
        () => ["All", ...new Set(crew.flatMap((worker) => worker.roles))].sort((a, b) => (a === "All" ? -1 : b === "All" ? 1 : a.localeCompare(b))),
        [crew],
    );

    const list = React.useMemo(() => {
        const q = query.trim().toLowerCase();
        return crew
            .filter((worker) => !existingWorkerIds.includes(worker.id))
            .filter((worker) => role === "All" || worker.roles.includes(role))
            .filter((worker) => !q || worker.name.toLowerCase().includes(q) || worker.roles.some((r) => r.toLowerCase().includes(q)))
            .sort((a, b) => (assessed?.get(a.id)?.rank ?? 1e6) - (assessed?.get(b.id)?.rank ?? 1e6) || a.name.localeCompare(b.name));
    }, [crew, existingWorkerIds, role, query, assessed]);

    const close = () => {
        setQuery("");
        setRole("All");
        onClose();
    };

    const pick = async (worker: (typeof crew)[number]) => {
        const warning = assessed?.get(worker.id)?.reasons[0];
        const selection: AddWorkerSelection = {
            id: worker.id,
            name: worker.name,
            avatar: worker.avatar,
            initials: worker.initials,
            invitePending: worker.invitePending,
            warning,
        };
        close();
        await onPick(selection);
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
            <SheetContent
                side="bottom"
                className="mx-auto flex max-h-[84vh] w-full max-w-[560px] flex-col gap-0 rounded-t-[20px] p-0"
            >
                <SheetHeader className="px-5 pb-3 pt-5 text-left">
                    <SheetTitle className="text-[17px] font-extrabold">Add worker</SheetTitle>
                    <SheetDescription className="text-[12.5px]">
                        {shift.title} · {format(parseISO(localDate), "EEE, MMM d")}. Tap a name and they&apos;re on the shift.
                    </SheetDescription>
                </SheetHeader>

                <div className="space-y-2.5 px-5 pb-3">
                    <div className="relative">
                        <Search aria-hidden="true" className="absolute left-3 top-3 size-4 text-muted-foreground" />
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search your team…"
                            aria-label="Search your team"
                            className="h-10 rounded-[11px] pl-9"
                        />
                    </div>
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by role">
                        {roles.map((r) => (
                            <button
                                key={r}
                                type="button"
                                aria-pressed={role === r}
                                onClick={() => setRole(r)}
                                className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${role === r ? "border-border bg-muted text-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted/60"}`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                </div>

                <ul className="min-h-[120px] flex-1 overflow-y-auto px-3 pb-4">
                    {isLoading ? (
                        <li className="py-10 text-center text-sm text-muted-foreground">Loading…</li>
                    ) : list.length === 0 ? (
                        <li className="py-10 text-center text-sm text-muted-foreground">
                            <b className="block text-[15px] text-foreground">No matches</b>
                            Try a different search or role.
                        </li>
                    ) : (
                        list.map((worker) => {
                            const check = assessed?.get(worker.id);
                            return (
                                <li key={worker.id}>
                                    <button
                                        type="button"
                                        onClick={() => void pick(worker)}
                                        className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <Avatar className="size-10">
                                            <AvatarFallback className="bg-muted text-[13px] font-extrabold text-muted-foreground">
                                                {worker.initials}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-[13.5px] font-bold text-foreground">{worker.name}</span>
                                            <span className="block truncate text-xs text-muted-foreground">
                                                {worker.invitePending ? "Invited, not accepted yet" : worker.roles.join(", ") || "No role set"}
                                            </span>
                                        </span>
                                        {check ? (
                                            check.reasons.length === 0 ? (
                                                <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-extrabold text-emerald-800">
                                                    Available
                                                </span>
                                            ) : (
                                                <span className="max-w-[55%] truncate whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-extrabold text-amber-900" title={check.reasons.join(" · ")}>
                                                    ⚠ {check.reasons[0]}
                                                </span>
                                            )
                                        ) : null}
                                    </button>
                                </li>
                            );
                        })
                    )}
                </ul>

                {onAddTemps ? (
                    <div className="border-t border-border px-5 py-3 text-center">
                        <button
                            type="button"
                            onClick={() => {
                                close();
                                onAddTemps();
                            }}
                            className="text-[13px] font-semibold text-primary hover:underline"
                        >
                            Add agency or temp workers instead
                        </button>
                    </div>
                ) : null}
            </SheetContent>
        </Sheet>
    );
}
