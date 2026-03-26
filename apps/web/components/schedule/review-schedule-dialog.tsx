"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@repo/ui/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { AlertTriangle, CalendarDays, Users } from "lucide-react";
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
    const stats = useMemo(() => {
        let totalShifts = 0;
        let totalAssigned = 0;
        let totalOpen = 0;
        const uniqueDates = new Set<string>();

        data.schedules.forEach(schedule => {
            let effectiveDates: Date[] = [];

            if (schedule.dates && schedule.dates.length > 0) {
                effectiveDates = schedule.dates;
            } else if (schedule.startDate && schedule.endDate && schedule.daysOfWeek) {
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
        };
    }, [data]);

    const formattedDates = stats.uniqueDates.map(d => format(new Date(d + "T00:00:00"), "EEEE, MMM d"));

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Ready to publish?</DialogTitle>
                    <DialogDescription>
                        Review the dates and staffing summary before notifications go out.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-6 py-4">
                    <div className="flex flex-col gap-2">
                        <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <CalendarDays className="h-4 w-4" />
                            Dates
                        </h4>
                        <div className="text-sm font-medium">
                            {formattedDates.length > 0 ? formattedDates.join(", ") : "No dates selected"}
                        </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                            <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
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
                    </div>

                    <Alert className="bg-muted/40">
                        <AlertTriangle className="h-5 w-5 shrink-0" />
                        <AlertTitle>Notifications will be sent</AlertTitle>
                        <AlertDescription>
                            {stats.totalAssigned} assigned crew members will be notified immediately.
                        </AlertDescription>
                    </Alert>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button onClick={() => onConfirm()} disabled={isSubmitting || stats.totalShifts === 0} data-testid="confirm-publish">
                        {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
                        Confirm & Publish
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
