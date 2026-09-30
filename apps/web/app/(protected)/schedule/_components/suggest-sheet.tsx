"use client";

import { useState } from "react";
import { CircleCheck } from "lucide-react";
import type { SchedulerWeek } from "@repo/contracts/scheduler";
import { Button } from "@repo/ui/components/ui/button";
import { compactRange, weekdayShort } from "@/lib/scheduler/format";
import { planAddPerson, type Plan } from "@/lib/scheduler/plans";
import { ResponsiveSheet } from "./responsive-sheet";
import { SuggestList } from "./suggest-list";

/**
 * "Who can work this?" for a spot that's still open. Stays open while you add
 * people, and tells you when the shift is full.
 */
export function SuggestSheet({
    week,
    shiftId,
    onClose,
    run,
    onOpenShift,
}: {
    week: SchedulerWeek;
    shiftId: string | null;
    onClose: () => void;
    run: (plan: Plan) => Promise<boolean>;
    onOpenShift: (shiftId: string) => void;
}) {
    const shift = shiftId ? week.shifts.find((s) => s.id === shiftId) ?? null : null;
    const [busy, setBusy] = useState(false);
    const full = shift ? shift.open === 0 : false;

    return (
        <ResponsiveSheet
            open={shift !== null}
            onOpenChange={(open) => !open && onClose()}
            testId="suggest-sheet"
            title="Who can work this?"
            description={
                shift
                    ? `${shift.role} · ${weekdayShort(shift.localDate)} ${compactRange(shift.startLocal, shift.endLocal)} · ${
                          full ? "all filled" : shift.open === 1 ? "1 spot open" : `${shift.open} spots open`
                      }`
                    : undefined
            }
            footer={
                shift ? (
                    <div className="flex items-center justify-between gap-3">
                        <button
                            type="button"
                            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                            onClick={() => {
                                onClose();
                                onOpenShift(shift.id);
                            }}
                        >
                            Change time or details
                        </button>
                        <Button type="button" variant={full ? "default" : "outline"} className="h-10" onClick={onClose}>
                            Done
                        </Button>
                    </div>
                ) : undefined
            }
        >
            {shift ? (
                full ? (
                    <div className="flex items-center gap-3 rounded-2xl bg-ok-soft px-4 py-3 text-ok">
                        <CircleCheck aria-hidden className="size-5 shrink-0" />
                        <p className="text-base font-semibold">All filled. Nice.</p>
                    </div>
                ) : (
                    <SuggestList
                        key={shift.id}
                        week={week}
                        shift={shift}
                        busy={busy}
                        onAdd={async (person) => {
                            const plan = planAddPerson(week, shift.id, person);
                            if (!plan) return;
                            setBusy(true);
                            try {
                                await run(plan);
                            } finally {
                                setBusy(false);
                            }
                        }}
                    />
                )
            ) : null}
        </ResponsiveSheet>
    );
}
