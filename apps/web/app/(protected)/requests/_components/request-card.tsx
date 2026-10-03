"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import type { ManagerRequest } from "@repo/contracts/requests";
import { Button } from "@repo/ui/components/ui/button";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { InitialsAvatar } from "@repo/ui/components/app/initials-avatar";
import { Pill } from "@repo/ui/components/app/pill";
import { roleHue } from "@repo/ui/lib/role-hue";
import { cn } from "@repo/ui/lib/utils";
import { decideRequest, requestConflictsOf } from "@/lib/scheduler/client";
import { shiftWhen, timeAgo, timeOffHasShifts, timeOffWhen } from "@/lib/scheduler/request-format";

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

export function RequestCard({ request: r, onDecided }: { request: ManagerRequest; onDecided: () => Promise<void> }) {
    const [note, setNote] = useState("");
    const [noteOpen, setNoteOpen] = useState(false);
    const [busy, setBusy] = useState<"approve" | "decline" | null>(null);
    const [conflicts, setConflicts] = useState(r.conflicts);
    const pending = r.status === "pending_manager" || r.status === "pending";
    const when = r.shift ? shiftWhen(r.shift) : r.timeOff ? timeOffWhen(r.timeOff) : null;
    const where = r.shift ? [r.shift.eventName ? `◆ ${r.shift.eventName}` : null, r.shift.locationName].filter(Boolean).join(" · ") : null;
    const hue = roleHue(r.shift?.role);
    // Time off that lands on shifts the person already has is the thing to see first.
    const [firstImpact, ...otherImpact] = r.impact;
    const clash = r.kind === "time_off" && timeOffHasShifts(r.impact);

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
        <article className="flex flex-col gap-2 rounded-panel border bg-card px-3.5 py-3" aria-label={headline(r)}>
            <div className="flex items-center gap-2.5">
                <InitialsAvatar name={r.requester.name} hue={hue} size="md" />
                <h3 className="min-w-0 flex-1 text-[13px] font-bold leading-snug">{headline(r)}</h3>
                <Pill tone={pending ? "neutral" : r.status === "approved" ? "success" : "neutral"}>{pending ? KIND_LABEL[r.kind] : (STATUS_LABEL[r.status] ?? KIND_LABEL[r.kind])}</Pill>
            </div>

            <p className="text-xs text-muted-foreground">
                {when ? (
                    <>
                        <span className="font-medium tabular-nums text-foreground">{when}</span>
                        {r.shift ? <> · {r.shift.role}</> : null}
                        {where ? <> · {where}</> : null}
                        {" · "}
                    </>
                ) : null}
                {pending
                    ? timeAgo(r.createdAt)
                    : [KIND_LABEL[r.kind], r.decidedByName ? `by ${r.decidedByName}` : null, r.decidedAt ? timeAgo(r.decidedAt) : null].filter(Boolean).join(" · ")}
            </p>

            {r.note ? (
                <p className="rounded-chip border bg-background px-2.5 py-1.5 text-xs italic text-muted-foreground">&ldquo;{r.note}&rdquo;</p>
            ) : null}
            {r.managerNote && !pending ? <p className="text-xs text-muted-foreground">Your note: {r.managerNote}</p> : null}

            {pending && firstImpact ? (
                <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                    <li className={cn(clash && "font-bold text-destructive")}>{firstImpact}</li>
                    {otherImpact.map((line) => (
                        <li key={line}>{line}</li>
                    ))}
                </ul>
            ) : null}
            {pending && conflicts.length ? (
                <ul className="flex flex-col gap-1 rounded-chip border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
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
                            <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => setNoteOpen(true)}>
                                Add a note
                            </button>
                        )}
                        <div className="flex gap-2">
                            <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={busy !== null} onClick={() => void decide("decline")}>
                                Decline
                            </Button>
                            <Button
                                size="sm"
                                variant={conflicts.length ? "destructive" : "default"}
                                className={cn(!conflicts.length && "bg-success text-success-foreground hover:bg-success/90")}
                                disabled={busy !== null}
                                onClick={() => void decide("approve")}
                            >
                                {conflicts.length ? "Approve anyway" : r.kind === "swap" ? "Approve swap" : "Approve"}
                            </Button>
                        </div>
                    </div>
                </>
            ) : null}
        </article>
    );
}
