"use client";

import * as React from "react";
import { Button } from "@repo/ui/components/ui/button";
import { ArrowLeft } from "lucide-react";

import { ShiftSummaryHeader } from "./timesheet/shift-summary-header";
import { ShiftApprovalFooter } from "./timesheet/shift-approval-footer";
import { TimesheetTable } from "./timesheet/timesheet-table";
import { AddWorkerDialog } from "./add-worker-dialog";

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
    const [isAddWorkerOpen, setIsAddWorkerOpen] = React.useState(false);

    // Sync state when upstream data arrives (Fixes async data missing bug)
    React.useEffect(() => {
        setWorkers(getWorkersFromProps());
    }, [getWorkersFromProps]);

    const updateWorker = (id: string, field: string, value: any) => {
        setWorkers((prev) =>
            prev.map((w) => (w.id === id ? { ...w, [field]: value } : w))
        );
    };

    const handleAddWorkers = (newWorkerIds: string[]) => {
        // In a real app, you'd call an API here (e.g., POST /shifts/:id/assign)
        // For now, we update local state optimistically.
        // We create placeholder entries so the UI updates immediately.

        const newWorkers = newWorkerIds.map(id => ({
            id,
            name: "New Worker (Refreshing...)", // Accessing name would require looking up in crew list
            avatar: `https://github.com/shadcn.png`,
            initials: "NW",
            shiftDuration: "-",
            hourlyRate: "$0/hr",
            clockIn: "",
            clockOut: "",
            breakDuration: "0 min",
            rating: 0,
        }));

        setWorkers(prev => [...prev, ...newWorkers]);
        // Ideally trigger a re-fetch or router.refresh() here 
        // router.refresh(); 
    };


    // Helper to calculate variants dynamically
    const getWorkerStatus = (worker: { clockIn?: string; clockOut?: string; breakDuration?: string }) => {
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
                {!isApproved && !isCancelled && (
                    <Button variant="outline" onClick={() => setIsAddWorkerOpen(true)}>
                        Add Pros
                    </Button>
                )}
            </div>

            {/* Content Card - Powered by TanStack Table */}
            <TimesheetTable
                data={workers}
                onUpdateWorker={updateWorker}
                isApproved={isApproved}
                isCancelled={isCancelled}
                getWorkerStatus={getWorkerStatus}
            />

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

            <AddWorkerDialog
                isOpen={isAddWorkerOpen}
                onClose={() => setIsAddWorkerOpen(false)}
                onConfirm={handleAddWorkers}
                existingWorkerIds={workers.map(w => w.id)}
            />
        </div>
    );
}
