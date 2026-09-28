"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { SchedulerTemplate, SchedulerWeek } from "@repo/contracts/scheduler";
import { Button } from "@repo/ui/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@repo/ui/components/ui/dialog";
import { cn } from "@repo/ui/lib/utils";
import { deleteTemplate, fetchSchedulerWeek, fetchTemplates, weekKey } from "@/lib/scheduler/client";
import { addDays, compactRange, weekdayShort } from "@/lib/scheduler/format";
import { planCopyWeek, planTemplate, type Plan } from "@/lib/scheduler/plans";

export function CopyWeekDialog({
    week,
    open,
    onOpenChange,
    run,
}: {
    week: SchedulerWeek;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    run: (plan: Plan, options: { onConflict: "leave-open" }) => Promise<boolean>;
}) {
    const lastWeekStart = addDays(week.weekStart, -7);
    const { data: last, isLoading } = useSWR(open ? weekKey(week.location.id, lastWeekStart) : null, fetchSchedulerWeek);
    const [working, setWorking] = useState(false);
    const count = last?.shifts.filter((s) => !s.pendingRemoval).length ?? 0;

    const copy = async (keepPeople: boolean) => {
        if (!last) return;
        setWorking(true);
        try {
            if (await run(planCopyWeek(last, week, keepPeople), { onConflict: "leave-open" })) onOpenChange(false);
        } finally {
            setWorking(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Copy last week</DialogTitle>
                    <DialogDescription>
                        {isLoading
                            ? "Looking at last week…"
                            : count
                                ? `${count} ${count === 1 ? "shift" : "shifts"} from the week of ${last!.days[0]!.localDate} land on the same weekdays and times as drafts. Nothing is sent to staff until you publish.`
                                : "Last week has no shifts at this location."}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:justify-between">
                    <Button variant="outline" disabled={!count || working} onClick={() => void copy(false)}>
                        As open shifts
                    </Button>
                    <Button disabled={!count || working} onClick={() => void copy(true)}>
                        With the same people
                    </Button>
                </DialogFooter>
                <p className="text-xs text-muted-foreground">
                    Anyone who can&apos;t work a copied shift (time off, double-booked) is left off, and their spot stays open.
                </p>
            </DialogContent>
        </Dialog>
    );
}

export function TemplateDialog({
    week,
    open,
    onOpenChange,
    run,
}: {
    week: SchedulerWeek;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    run: (plan: Plan) => Promise<boolean>;
}) {
    const { data: templates, isLoading, mutate } = useSWR(open ? ["scheduler-templates", week.location.id] : null, ([, id]) => fetchTemplates(id));
    const [chosen, setChosen] = useState<SchedulerTemplate | null>(null);
    const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
    const [days, setDays] = useState<Set<number>>(new Set());
    const [working, setWorking] = useState(false);

    const toggle = (index: number) => {
        const next = new Set(days);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        setDays(next);
    };

    const remove = async (template: SchedulerTemplate) => {
        setConfirmingDelete(null);
        try {
            await deleteTemplate(template.id);
            if (chosen?.id === template.id) setChosen(null);
            await mutate();
            toast.success(`Deleted ${template.name}`);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Couldn't delete it");
        }
    };

    const apply = async () => {
        if (!chosen || days.size === 0) return;
        setWorking(true);
        try {
            if (await run(planTemplate(week, chosen, [...days].sort()))) {
                onOpenChange(false);
                setChosen(null);
                setDays(new Set());
            }
        } finally {
            setWorking(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Use a template</DialogTitle>
                    <DialogDescription>Adds the template&apos;s positions as open drafts on the days you pick.</DialogDescription>
                </DialogHeader>
                {isLoading ? <p className="text-sm text-muted-foreground">Loading templates…</p> : null}
                {templates && templates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No templates for {week.location.name} yet. Save one from any shift&apos;s timesheet page with &ldquo;Save as template&rdquo;.
                    </p>
                ) : null}
                <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
                    {templates?.map((t) => (
                        <li key={t.id} className="group/template relative">
                            <button
                                type="button"
                                aria-pressed={chosen?.id === t.id}
                                onClick={() => setChosen(t)}
                                className={cn(
                                    "flex w-full flex-col items-start rounded-lg border px-3 py-2 pr-10 text-left text-sm transition-colors hover:bg-muted/60",
                                    chosen?.id === t.id && "border-primary bg-primary/5",
                                )}
                            >
                                <span className="font-medium">{t.name}</span>
                                <span className="text-xs text-muted-foreground">
                                    {compactRange(t.startTime, t.endTime)} · {t.positions.map((p) => `${p.headcount} ${p.roleName}`).join(", ")}
                                </span>
                            </button>
                            {confirmingDelete === t.id ? (
                                <div className="absolute inset-0 flex items-center justify-end gap-2 rounded-lg border border-destructive/40 bg-card px-3 text-sm">
                                    <span className="mr-auto">Delete {t.name}?</span>
                                    <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(null)}>
                                        Keep
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={() => void remove(t)}>
                                        Delete
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    aria-label={`Delete ${t.name}`}
                                    className="absolute right-1 top-1/2 size-8 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover/template:opacity-100"
                                    onClick={() => setConfirmingDelete(t.id)}
                                >
                                    <Trash2 />
                                </Button>
                            )}
                        </li>
                    ))}
                </ul>
                {chosen ? (
                    <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium">Which days?</span>
                        <div className="flex flex-wrap gap-1.5">
                            {week.days.map((d) => (
                                <button
                                    key={d.index}
                                    type="button"
                                    aria-pressed={days.has(d.index)}
                                    onClick={() => toggle(d.index)}
                                    className={cn(
                                        "rounded-md border px-2.5 py-1.5 text-sm font-medium",
                                        days.has(d.index) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                                    )}
                                >
                                    {weekdayShort(d.localDate)} {Number(d.localDate.slice(8))}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : null}
                <DialogFooter>
                    <Button disabled={!chosen || days.size === 0 || working} onClick={() => void apply()}>
                        Add {chosen ? chosen.headcount * days.size : 0} open spots
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
