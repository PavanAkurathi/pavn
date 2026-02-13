"use client";

import * as React from "react";
import { Button } from "@repo/ui/components/ui/button";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@repo/ui/components/ui/dialog";

import { ShiftSummaryHeader } from "./timesheet/shift-summary-header";
import { ShiftApprovalFooter } from "./timesheet/shift-approval-footer";
import { TimesheetTable } from "./timesheet/timesheet-table";
import { AddWorkerDialog } from "./add-worker-dialog";

import { Shift, TimesheetWorker } from "@/lib/types";
import { format } from "date-fns";
import { toast } from "sonner";
import { getWorkerStatus, parseTimeStringToIso, UpdateTimesheetPayload } from "@/lib/timesheet-utils";

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
                    clockIn: ts.clockIn ? format(new Date(ts.clockIn), "hh:mm a") : "",
                    clockOut: ts.clockOut ? format(new Date(ts.clockOut), "hh:mm a") : "",
                    breakDuration: `${ts.breakMinutes} min`,
                    rating: 0,
                    jobTitle: "Event Staff", // Default or derive from shift role
                };
            }
            return {
                id: assigned.id,
                name: assigned.name || "Worker Name",
                avatar: assigned.avatarUrl || `https://github.com/shadcn.png`,
                initials: assigned.initials,
                shiftDuration: "-",
                clockIn: "",
                clockOut: "",
                breakDuration: "0 min",
                rating: 0,
                jobTitle: "Event Staff",
            };
        });
    }, [shift.assignedWorkers, timesheets]);

    // Initialize state
    const [workers, setWorkers] = React.useState(getWorkersFromProps);
    const [isAddWorkerOpen, setIsAddWorkerOpen] = React.useState(false);
    const [isCancelConfirmOpen, setIsCancelConfirmOpen] = React.useState(false);
    const [isCancelling, setIsCancelling] = React.useState(false);

    // State for Save Confirmation Dialog
    const [pendingSave, setPendingSave] = React.useState<{
        id: string;
        field: string;
        value: any;
        payload: UpdateTimesheetPayload;
        action: string;
        workerName: string;
        fieldLabel: string;
    } | null>(null);

    // Sync state when upstream data arrives (Fixes async data missing bug)
    React.useEffect(() => {
        setWorkers(getWorkersFromProps());
    }, [getWorkersFromProps]);

    const updateWorker = (id: string, field: string, value: any) => {
        setWorkers((prev) =>
            prev.map((w) => (w.id === id ? { ...w, [field]: value } : w))
        );
    };

    const handleAddWorkers = async (newWorkerIds: string[]) => {
        try {
            await import("@/lib/api/shifts").then(mod => mod.assignWorkers(shift.id, newWorkerIds));
            toast.success(`Assigned ${newWorkerIds.length} workers successfully`);

            // Re-fetch all data to ensure consistent state/avatars/names
            // Since we don't have a direct refetch function here, we can trigger a router refresh or 
            // manually optimistically update if we had full worker objects.
            // But AddWorkerDialog only passes IDs.
            // Ideally, onBack() or a dedicated refetch logic should be used.
            // For now, let's keep the optimistic update but relying on page reload for full details is safer if complex.
            // However, the previous optimistic code has placeholder names.
            // Let's rely on router refresh if possible, but we are client side.
            // Actually, we can just Optimistically update and assume success, but best is to reload page data.
            window.location.reload();
        } catch (error) {
            console.error(error);
            toast.error("Failed to assign workers");
        }
    };


    // Helper to calculate variants dynamically
    // Logic moved to @/lib/timesheet-utils

    // Calculate generic error state (Blocking ONLY if data is MISSING)
    // "disable the button only when the clock in or clock out or breaks are not avaiable"
    const hasErrors = workers.some(
        (w) => !w.clockIn || !w.clockOut || !w.breakDuration
    );

    // Mock totals
    const totalHours = "19 hrs, 34 mins";

    const isApproved = shift.status === 'approved';
    const isCancelled = shift.status === 'cancelled';

    // Dynamic Counts
    const workerCount = workers.length;
    const filledCount = workers.filter(w => !!w.clockIn && !!w.clockOut).length;

    const confirmSave = async () => {
        if (!pendingSave) return;

        try {
            await import("@/lib/api/shifts").then(mod =>
                mod.updateTimesheet(shift.id, pendingSave.id, pendingSave.action, pendingSave.payload)
            );
            toast.success("Timesheet saved");
        } catch (e) {
            console.error(e);
            toast.error("Failed to save timesheet");
        } finally {
            setPendingSave(null);
        }
    };

    const cancelSave = () => {
        setPendingSave(null);
    };

    // Auto-save handler (Debounce or onBlur handled by child)
    const saveTimesheetEntry = async (id: string, field: string, value: any) => {
        // Optimistic update already happened via updateWorker
        // Now identify the action type
        let action = 'update_time';
        let data: any = {};

        // Find the worker from current state to get complete object
        const latestWorker = workers.find(w => w.id === id);
        if (!latestWorker) return;

        // Construct payload based on what changed, but backend expects full or partial time object
        // We'll send the updated fields.
        // Note: The backend update_time expects { clockIn, clockOut, breakMinutes }

        // Helper to parse time strings back to Date ISO strings if needed, 
        // OR the backend controller lines 58-59: new Date(data.clockIn).
        // Our UI uses "hh:mm a" format (e.g. "05:00 PM") or ISO? 
        // Reviewing ShiftDetailView getWorkersFromProps:
        // clockIn: ts.clockIn ? format(new Date(ts.clockIn), "hh:mm a") : ""
        // So the State `workers` holds "05:00 PM".
        // The backend `new Date("05:00 PM")` might fail or result in Invalid Date if not fully qualified with date.

        // CRITICAL FIX: We need to convert the UI time string back to a valid Date object relative to the shift date.
        // We should start with shift.startTime day.

        try {
            const shiftDate = new Date(shift.startTime); // Base date

            // We need to re-construct the payload with ISO strings
            if (field === 'clockIn') {
                data.clockIn = parseTimeStringToIso(value, shiftDate);
                // Send existing output too
                // Backend overwrites with null if missing. We must send BOTH.

                data.clockOut = parseTimeStringToIso(latestWorker.clockOut, shiftDate);
                data.breakMinutes = parseInt(latestWorker.breakDuration) || 0; // "30 min" -> 30
            } else if (field === 'clockOut') {
                data.clockIn = parseTimeStringToIso(latestWorker.clockIn, shiftDate);
                data.clockOut = parseTimeStringToIso(value, shiftDate);
                data.breakMinutes = parseInt(latestWorker.breakDuration) || 0;
            } else if (field === 'breakDuration') {
                data.clockIn = parseTimeStringToIso(latestWorker.clockIn, shiftDate);
                data.clockOut = parseTimeStringToIso(latestWorker.clockOut, shiftDate);
                data.breakMinutes = parseInt(value) || 0;
            }

            // NEW LOGIC: Show Alert with Save Action instead of auto-save
            const workerName = workers.find(w => w.id === id)?.name || "Worker";
            const fieldLabel = field === 'clockIn' ? 'Clock In' : field === 'clockOut' ? 'Clock Out' : 'Break';

            // Format value for display if possible (value is already formatted string for inputs usually)
            // But we need to capture the payload data for the API call in a closure for the action

            setPendingSave({
                id,
                field,
                value,
                payload: data,
                action,
                workerName,
                fieldLabel
            });

        } catch (e) {
            console.error(e);
            toast.error("Error preparing save");
        }
    };

    const handleCancelShift = async () => {
        setIsCancelling(true);
        try {
            await import("@/lib/api/shifts").then(mod => mod.cancelShift(shift.id));
            toast.success("Shift cancelled successfully");
            onBack(); // Return to previous screen
        } catch (error) {
            console.error(error);
            toast.error("Failed to cancel shift");
        } finally {
            setIsCancelling(false);
            setIsCancelConfirmOpen(false);
        }
    };


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
            {!isApproved && !isCancelled && (
                <Button variant="destructive" onClick={() => setIsCancelConfirmOpen(true)}>
                    Cancel Shift
                </Button>
            )}
            {/* Shift Summary Header */}
            {/* Shift Summary Header */}
            <ShiftSummaryHeader
                title={shift.title}
                role="Event Staff" // Derive from shift or role data

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
                onSaveWorker={saveTimesheetEntry}
                isApproved={isApproved}
                isCancelled={isCancelled}
            />

            {
                !isCancelled && (
                    <ShiftApprovalFooter
                        workerCount={workerCount}
                        filledCount={filledCount}
                        totalHours={totalHours}

                        hasErrors={hasErrors}
                        isApproved={isApproved}
                        onApprove={() => onApprove?.()}
                    />
                )
            }

            <AddWorkerDialog
                isOpen={isAddWorkerOpen}
                onClose={() => setIsAddWorkerOpen(false)}
                onConfirm={handleAddWorkers}
                existingWorkerIds={workers.map(w => w.id)}
            />

            <Dialog open={!!pendingSave} onOpenChange={(open) => !open && cancelSave()}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-amber-500" />
                            Unsaved Changes
                        </DialogTitle>
                        <DialogDescription>
                            You have modified the <strong>{pendingSave?.fieldLabel}</strong> for <strong>{pendingSave?.workerName}</strong>.
                            Do you want to save this change permanently?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2 text-sm text-muted-foreground bg-muted/30 p-3 rounded-md border">
                        New Value: <span className="text-foreground font-semibold">{pendingSave?.value?.toString()}</span>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={cancelSave}>Cancel</Button>
                        <Button onClick={confirmSave}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Cancel Confirmation Dialog */}
            <Dialog open={isCancelConfirmOpen} onOpenChange={setIsCancelConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-red-500" />
                            Cancel Shift
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to cancel this shift? This action will notify all assigned workers and cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCancelConfirmOpen(false)}>Keep Shift</Button>
                        <Button variant="destructive" onClick={handleCancelShift} disabled={isCancelling}>
                            {isCancelling ? "Cancelling..." : "Yes, Cancel Shift"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}

