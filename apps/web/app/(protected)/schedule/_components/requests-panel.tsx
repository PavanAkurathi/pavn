"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import type { ManagerRequest } from "@repo/contracts/requests";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@repo/ui/components/ui/sheet";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { cn } from "@repo/ui/lib/utils";
import { REQUESTS_SUMMARY_KEY, decideRequest, fetchRequests, requestConflictsOf, requestsKey } from "@/lib/scheduler/client";
import { shiftWhen, timeAgo, timeOffWhen } from "@/lib/scheduler/request-format";

type View = "pending" | "recent";

const KIND_LABEL: Record<ManagerRequest["kind"], string> = {
    claim: "Open shift",
    drop: "Drop",
    swap: "Swap",
    time_off: "Time off",
};

const STATUS_LABEL: Partial<Record<ManagerRequest["status"], string>> = {
    approved: "Approved",
    declined: "Declined",
    cancelled: "Cancelled",
    expired: "Expired",
};

export function RequestsPanel({
    open,
    onOpenChange,
    onDecided,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The week changed (someone was put on or taken off a shift). */
    onDecided: () => void;
}) {
    const [view, setView] = useState<View>("pending");
    const { mutate: mutateGlobal } = useSWRConfig();
    const { data, error, isLoading, mutate } = useSWR(open ? requestsKey(view) : null, fetchRequests, { keepPreviousData: true });
    const requests = data?.requests ?? [];

    const decided = async () => {
        await Promise.all([mutate(), mutateGlobal(REQUESTS_SUMMARY_KEY), mutateGlobal(requestsKey("recent"))]);
        onDecided();
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg">
                <SheetHeader className="gap-1 border-b p-5 text-left">
                    <SheetTitle>Requests</SheetTitle>
                    <SheetDescription>Time off, swaps, drops and open-shift claims from the app. People hear back as soon as you decide.</SheetDescription>
                    <div role="group" aria-label="Show" className="mt-2 flex h-8 w-fit items-center gap-0.5 rounded-md border bg-muted p-0.5">
                        {(
                            [
                                ["pending", `Waiting${data && view === "pending" ? ` (${data.pendingCount})` : ""}`],
                                ["recent", "Decided"],
                            ] as const
                        ).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                aria-pressed={view === value}
                                onClick={() => setView(value)}
                                className={cn(
                                    "h-full rounded px-3 text-[13px] font-medium text-muted-foreground hover:text-foreground",
                                    view === value && "bg-card text-foreground shadow-sm",
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </SheetHeader>

                <div className="flex flex-col gap-3 p-5" aria-busy={isLoading}>
                    {error ? (
                        <p role="alert" className="text-sm text-destructive">
                            Couldn&apos;t load requests: {error.message}
                        </p>
                    ) : null}
                    {!isLoading && !error && requests.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {view === "pending"
                                ? "Nothing waiting. When someone asks for time off, a swap, a drop or an open shift in the app, it shows up here."
                                : "Nothing decided in the last two weeks."}
                        </p>
                    ) : null}
                    {requests.map((r) => (
                        <RequestCard key={`${r.id}:${r.status}`} request={r} onDecided={decided} />
                    ))}
                </div>
            </SheetContent>
        </Sheet>
    );
}

function headline(r: ManagerRequest) {
    switch (r.kind) {
        case "claim":
            return `${r.requester.name} wants to pick up ${r.shift?.role ?? "a shift"}`;
        case "drop":
            return `${r.requester.name} asks to come off ${r.shift?.role ?? "a shift"}`;
        case "swap":
            return `${r.requester.name} → ${r.target?.name ?? "a coworker"}`;
        case "time_off":
            return `${r.requester.name} asks for time off`;
    }
}

function RequestCard({ request: r, onDecided }: { request: ManagerRequest; onDecided: () => Promise<void> }) {
    const [note, setNote] = useState("");
    const [noteOpen, setNoteOpen] = useState(false);
    const [busy, setBusy] = useState<"approve" | "decline" | null>(null);
    const [conflicts, setConflicts] = useState(r.conflicts);
    const pending = r.status === "pending_manager" || r.status === "pending";
    const when = r.shift ? shiftWhen(r.shift) : r.timeOff ? timeOffWhen(r.timeOff) : null;
    const where = r.shift ? [r.shift.eventName ? `◆ ${r.shift.eventName}` : null, r.shift.locationName].filter(Boolean).join(" · ") : null;

    const decide = async (decision: "approve" | "decline") => {
        setBusy(decision);
        try {
            await decideRequest(r.id, decision, { note: note.trim() || undefined, force: decision === "approve" && conflicts.length > 0 });
            toast.success(`${decision === "approve" ? "Approved" : "Declined"}. ${r.requester.name.split(" ")[0]} has been told.`);
            await onDecided();
        } catch (error) {
            const reasons = requestConflictsOf(error);
            if (reasons) setConflicts(reasons);
            toast.error(error instanceof Error ? error.message : "Couldn't save that");
        } finally {
            setBusy(null);
        }
    };

    return (
        <article className="flex flex-col gap-2 rounded-lg border bg-card p-4" aria-label={headline(r)}>
            <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className="font-medium">
                    {KIND_LABEL[r.kind]}
                </Badge>
                <span className="text-xs text-muted-foreground">
                    {pending ? timeAgo(r.createdAt) : [STATUS_LABEL[r.status], r.decidedByName ? `by ${r.decidedByName}` : null, r.decidedAt ? timeAgo(r.decidedAt) : null].filter(Boolean).join(" · ")}
                </span>
            </div>
            <h3 className="text-[15px] font-semibold leading-snug">{headline(r)}</h3>
            {when ? (
                <p className="text-sm">
                    <span className="font-medium tabular-nums">{when}</span>
                    {r.shift ? <span className="text-muted-foreground"> · {r.shift.role}</span> : null}
                    {where ? <span className="text-muted-foreground"> · {where}</span> : null}
                </p>
            ) : null}
            {r.note ? <p className="text-sm italic text-muted-foreground">&ldquo;{r.note}&rdquo;</p> : null}
            {r.managerNote && !pending ? <p className="text-sm text-muted-foreground">Your note: {r.managerNote}</p> : null}

            {pending && r.impact.length ? (
                <ul className="flex flex-col gap-0.5 text-[13px] text-muted-foreground">
                    {r.impact.map((line) => (
                        <li key={line}>{line}</li>
                    ))}
                </ul>
            ) : null}
            {pending && conflicts.length ? (
                <ul className="flex flex-col gap-1 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
                    {conflicts.map((line) => (
                        <li key={line} className="flex items-start gap-1.5">
                            <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                            {line}
                        </li>
                    ))}
                </ul>
            ) : null}

            {pending ? (
                <>
                    {noteOpen ? (
                        <Textarea
                            aria-label={`Note to ${r.requester.name}`}
                            rows={2}
                            autoFocus
                            maxLength={500}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Sent with your answer"
                        />
                    ) : null}
                    <div className="flex items-center justify-between gap-2 pt-1">
                        {noteOpen ? (
                            <span />
                        ) : (
                            <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => setNoteOpen(true)}>
                                Add a note
                            </button>
                        )}
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void decide("decline")}>
                                Decline
                            </Button>
                            <Button
                                size="sm"
                                variant={conflicts.length ? "destructive" : "default"}
                                disabled={busy !== null}
                                onClick={() => void decide("approve")}
                            >
                                {conflicts.length ? "Approve anyway" : "Approve"}
                            </Button>
                        </div>
                    </div>
                </>
            ) : null}
        </article>
    );
}
