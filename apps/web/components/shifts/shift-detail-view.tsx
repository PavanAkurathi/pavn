"use client";

import * as React from "react";
import { Button } from "@repo/ui/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { TimesheetRow } from "./timesheet/timesheet-row";
import { ShiftSummaryHeader } from "./timesheet/shift-summary-header";
import { ShiftApprovalFooter } from "./timesheet/shift-approval-footer";

import { Shift, TimesheetWorker } from "@/lib/types";
import { format } from "date-fns";

interface ShiftDetailViewProps {
    onBack: () => void;
    shift: Shift;
    timesheets: TimesheetWorker[];
    onApprove?: () => void;
}

export function ShiftDetailView({ onBack, shift, timesheets, onApprove }: ShiftDetailViewProps) {
    // Helper to merge data (extracted for reuse)
    const getWorkersFromProps = React.useCallback(() => {
        const allWorkers = shift.assignedWorkers || [];
        return allWorkers.map((assigned) => {
            const ts = timesheets.find(t => t.id === assigned.id);
            if (ts) {
                return {
                    id: ts.id,
                    name: ts.name,
                    avatar: assigned.avatarUrl || `https://github.com/shadcn.png`,
                    initials: ts.avatarInitials || assigned.initials,
                    shiftDuration: "6 hrs",
                    hourlyRate: `$${ts.hourlyRate}/hr`,
                    clockIn: ts.clockIn ? format(new Date(ts.clockIn), "hh:mm a") : "",
                    clockOut: ts.clockOut ? format(new Date(ts.clockOut), "hh:mm a") : "",
                    breakDuration: `${ts.breakMinutes} min`,
                    rating: 0,
                };
            }
            return {
                id: assigned.id,
                name: assigned.name || "Worker Name",
                avatar: assigned.avatarUrl || `https://github.com/shadcn.png`,
                initials: assigned.initials,
                shiftDuration: "-",
                hourlyRate: "$0/hr",
                clockIn: "",
                clockOut: "",
                breakDuration: "0 min",
                rating: 0,
            };
        });
    }, [shift.assignedWorkers, timesheets]);

    // Initialize state
    const [workers, setWorkers] = React.useState(getWorkersFromProps);

    // Sync state when upstream data arrives (Fixes async data missing bug)
    React.useEffect(() => {
        setWorkers(getWorkersFromProps());
    }, [getWorkersFromProps]);

    const updateWorker = (id: string, field: string, value: any) => {
        setWorkers((prev) =>
            prev.map((w) => (w.id === id ? { ...w, [field]: value } : w))
        );
    };


    // Helper to calculate variants dynamically
    const getWorkerStatus = (worker: typeof workers[0]) => {
        let clockInVariant: "default" | "destructive" | "warning" = "default";
        let clockOutVariant: "default" | "destructive" | "warning" = "default";
        let breakVariant: "default" | "destructive" | "warning" = "default";

        // Clock In Logic
        if (!worker.clockIn) clockInVariant = "destructive"; // Missing = Red
        else if (worker.clockIn !== "05:00 PM" && worker.clockIn !== "05:00 AM") clockInVariant = "destructive"; // Late = Red

        // Clock Out Logic
        if (!worker.clockOut) clockOutVariant = "destructive"; // Missing = Red
        else if (worker.clockOut === "12:00 AM" || worker.clockOut > "11:30 PM") clockOutVariant = "warning"; // OT = Amber

        // Break Logic
        if (!worker.breakDuration || worker.breakDuration === "0 min") breakVariant = "destructive"; // Missing/Zero = Red

        return { clockInVariant, clockOutVariant, breakVariant };
    };

    // Calculate generic error state (Blocking ONLY if data is MISSING)
    // "disable the button only when the clock in or clock out or breaks are not avaiable"
    const hasErrors = workers.some(
        (w) => !w.clockIn || !w.clockOut || !w.breakDuration
    );

    // Mock totals
    const totalHours = "19 hrs, 34 mins";
    const totalCost = "~ $1,250.00";

    const isApproved = shift.status === 'approved';
    const isCancelled = shift.status === 'cancelled';

    // Dynamic Counts
    const workerCount = workers.length;
    const filledCount = workers.filter(w => !!w.clockIn && !!w.clockOut).length;

    return (
        <div className="flex flex-col space-y-6 pb-24">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onBack}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-semibold tracking-tight">Timesheets</h2>
                        {isApproved && (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                Approved
                            </span>
                        )}
                        {isCancelled && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                                Cancelled
                            </span>
                        )}
                        {!isApproved && !isCancelled && (
                            <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-medium text-black">
                                {filledCount} of {workerCount} filled
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Shift Summary Header */}
            <ShiftSummaryHeader
                title={shift.title}
                role="Event Staff" // Derive from shift or role data
                rate={`$${shift.price}`} // Assuming price is total or rate, usually rate needs explicit field
                date={format(new Date(shift.startTime), "EEE, MMM d, yyyy")}
                location={shift.locationName}
                timeRange={`${format(new Date(shift.startTime), "h:mm a")} - ${format(new Date(shift.endTime), "h:mm a")}`}
                breakDuration="30 min break"
                createdBy="Admin"
                createdAt="Oct 14, 11:37 PM"
            />

            {/* Header Actions */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-tight">Timesheets</h2>
                    <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-medium text-black">
                        {filledCount} of {workerCount} filled
                    </span>
                </div>
                {!isApproved && !isCancelled && <Button variant="outline">Add Pros</Button>}
            </div>

            {/* Content Card */}
            <div className="rounded-lg border border-border bg-card shadow-sm">
                {/* Table Header (Desktop) */}
                <div className="hidden border-b border-border bg-muted/30 px-4 py-3 text-xs font-medium text-muted-foreground md:flex">
                    <div className="w-[250px] pl-2">Name</div>
                    <div className="w-[150px] text-center">Clock-in</div>
                    <div className="w-[150px] text-center">Clock-out</div>
                    <div className="w-[150px] text-center">Total unpaid break</div>
                    <div className="w-[120px] text-center">Rating</div>
                    <div className="w-[100px] text-center">Write Up</div>
                </div>

                {/* Rows */}
                <div className="flex flex-col px-4">
                    {workers.length === 0 ? (
                        <div className="py-8 text-center text-muted-foreground">
                            No workers assigned to this shift.
                        </div>
                    ) : (
                        workers.map((worker) => {
                            const status = getWorkerStatus(worker);
                            return (
                                <TimesheetRow
                                    key={worker.id}
                                    workerName={worker.name}
                                    workerAvatar={worker.avatar}
                                    shiftDuration={worker.shiftDuration}
                                    hourlyRate={worker.hourlyRate}
                                    clockIn={worker.clockIn}
                                    clockOut={worker.clockOut}
                                    breakDuration={worker.breakDuration}
                                    rating={worker.rating}
                                    clockInVariant={status.clockInVariant}
                                    clockOutVariant={status.clockOutVariant}
                                    breakVariant={status.breakVariant}
                                    disabled={isApproved || isCancelled}
                                    onClockInChange={(val) => updateWorker(worker.id, "clockIn", val)}
                                    onClockOutChange={(val) => updateWorker(worker.id, "clockOut", val)}
                                    onBreakChange={(val) => updateWorker(worker.id, "breakDuration", val)}
                                    onRatingChange={(r) => updateWorker(worker.id, "rating", r)}
                                    onWriteUp={() => console.log("Write Up", worker.name)}
                                    onAddToRoster={() => console.log("Add", worker.name)}
                                    onReturn={() => console.log("Return", worker.name)}
                                    onBlock={() => console.log("Block", worker.name)}
                                />
                            );
                        })
                    )}
                </div>
            </div>

            {!isCancelled && (
                <ShiftApprovalFooter
                    workerCount={workerCount}
                    filledCount={filledCount}
                    totalHours={totalHours}
                    totalCost={totalCost}
                    hasErrors={hasErrors}
                    isApproved={isApproved}
                    onApprove={() => onApprove?.()}
                />
            )}
        </div>
    );
}
