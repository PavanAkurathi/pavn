"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import { Separator } from "@repo/ui/components/ui/separator";
import { AlertTriangle, CalendarDays, Users, DollarSign, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useMemo } from "react";

// Reuse types from form
import { FormValues } from "./create-schedule-form";

interface ReviewScheduleDialogProps {
    isOpen: boolean;
    onClose: () => void;
    data: FormValues;
    onConfirm: () => void;
    isSubmitting: boolean;
}

export function ReviewScheduleDialog({ isOpen, onClose, data, onConfirm, isSubmitting }: ReviewScheduleDialogProps) {

    // Calculate Stats
    const stats = useMemo(() => {
        let totalShifts = 0;
        let totalAssigned = 0;
        let totalOpen = 0;
        let uniqueDates = new Set<string>();
        let estimatedCost = 0;

        data.schedules.forEach(schedule => {
            // Determine effective dates
            let effectiveDates: Date[] = [];

            if (schedule.dates && schedule.dates.length > 0) {
                effectiveDates = schedule.dates;
            } else if (schedule.startDate && schedule.endDate && schedule.daysOfWeek) {
                // Expand Pattern
                let current = new Date(schedule.startDate);
                const end = new Date(schedule.endDate);
                while (current <= end) {
                    if (schedule.daysOfWeek.includes(current.getDay())) {
                        effectiveDates.push(new Date(current));
                    }
                    current.setDate(current.getDate() + 1);
                }
            }

            effectiveDates.forEach(d => uniqueDates.add(format(d, "yyyy-MM-dd")));

            const positionCount = schedule.positions.length;
            const shiftCountForBlock = positionCount * effectiveDates.length;

            totalShifts += shiftCountForBlock;

            // Cost Calculation (Mock: $20/hr * duration * shifts)
            const startH = parseInt(schedule.startTime.split(':')[0] || "0");
            const endH = parseInt(schedule.endTime.split(':')[0] || "0");
            const breakM = parseInt(schedule.breakDuration || "0");

            let durationHours = (endH - startH);
            if (durationHours < 0) durationHours += 24;
            durationHours -= (breakM / 60);

            if (durationHours > 0) {
                estimatedCost += (durationHours * 20 * shiftCountForBlock);
            }

            // Positions * Occurrences
            schedule.positions.forEach(pos => {
                if (pos.workerId) totalAssigned += effectiveDates.length;
                else totalOpen += effectiveDates.length;
            });
        });

        return {
            totalShifts,
            totalAssigned,
            totalOpen,
            uniqueDates: Array.from(uniqueDates).sort(),
            estimatedCost
        };
    }, [data]);

    const formattedDates = stats.uniqueDates.map(d => format(new Date(d + "T00:00:00"), "EEEE, MMM d"));

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Ready to publish?</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* 1. Dates */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <CalendarDays className="h-4 w-4" />
                            Dates
                        </h4>
                        <div className="text-sm font-medium">
                            {formattedDates.length > 0 ? formattedDates.join(", ") : "No dates selected"}
                        </div>
                    </div>

                    <Separator />

                    {/* 2. Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Staffing
                            </h4>
                            <div className="text-sm">
                                <span className="font-bold">{stats.totalShifts}</span> Shifts Total
                            </div>
                            <div className="text-xs text-muted-foreground pl-6">
                                {stats.totalAssigned} Assigned • {stats.totalOpen} Open
                            </div>
                        </div>
                        <div className="space-y-1">
                            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <DollarSign className="h-4 w-4" />
                                Est. Cost
                            </h4>
                            <div className="text-sm font-bold">
                                ${stats.estimatedCost.toFixed(2)}
                            </div>
                            <div className="text-xs text-muted-foreground pl-6">
                                Based on $20/hr avg
                            </div>
                        </div>
                    </div>

                    {/* 3. Warning */}
                    <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex gap-3 text-amber-800 text-sm">
                        <AlertTriangle className="h-5 w-5 shrink-0" />
                        <div>
                            <p className="font-medium">Notifications will be sent</p>
                            <p className="opacity-90 mt-1">
                                {stats.totalAssigned} assigned crew members will be notified immediately.
                            </p>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button onClick={onConfirm} disabled={isSubmitting || stats.totalShifts === 0} data-testid="confirm-publish">
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm & Publish
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
