"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui/components/ui/button";
import { ArrowLeft, AlertCircle, UserPlus, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@repo/ui/components/ui/dialog";
import { Textarea } from "@repo/ui/components/ui/textarea";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@repo/ui/components/ui/alert-dialog";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";

import { ShiftSummaryHeader } from "./timesheet/shift-summary-header";
import { ShiftApprovalBanner } from "./timesheet/shift-approval-banner";
import { TimesheetTable } from "./timesheet/timesheet-table";
import { AddWorkerDialog } from "./add-worker-dialog";

import { Shift, TimesheetWorker } from "@/lib/types";
import { differenceInMinutes, format } from "date-fns";
import { toast } from "sonner";
import {
    calculateTrackedMinutes,
    combineBreakDurations,
    formatTrackedMinutes,
    getRecommendedBreakMinutes,
    parseTimeStringToIso,
    splitBreakMinutes,
    UpdateTimesheetPayload,
    TimesheetViewModel,
    workerNeedsAttention,
} from "@/lib/timesheet-utils";
import { getDashboardMockCrew, isDashboardMockShiftId } from "@/lib/shifts/data";

interface ShiftDetailViewProps {
    onBack: () => void;
    shift: Shift;
    timesheets: TimesheetWorker[];
    onApprove?: () => void;
}

export function ShiftDetailView({ onBack, shift, timesheets, onApprove }: ShiftDetailViewProps) {
    const router = useRouter();
    const scheduledMinutes = Math.max(
        0,
        differenceInMinutes(new Date(shift.endTime), new Date(shift.startTime)),
    );
    const scheduledDurationLabel = formatTrackedMinutes(scheduledMinutes);

    const getWorkersFromProps = React.useCallback((): TimesheetViewModel[] => {
        const allWorkers = shift.assignedWorkers || [];
        const roleLabel = timesheets[0]?.role || "Event Staff";
        return allWorkers.map((assigned) => {
            const ts = timesheets.find((entry) => entry.workerId === assigned.id);
            if (ts) {
                const splitBreaks = splitBreakMinutes(ts.breakMinutes);
                return {
                    id: assigned.id,
                    name: ts.name,
                    avatar: ts.avatarUrl || assigned.avatarUrl || "",
                    initials: ts.avatarInitials || assigned.initials,
                    shiftDuration: scheduledDurationLabel,
                    scheduledMinutes,
                    clockIn: ts.clockIn ? format(new Date(ts.clockIn), "hh:mm a") : "",
                    clockOut: ts.clockOut ? format(new Date(ts.clockOut), "hh:mm a") : "",
                    breakDuration: `${ts.breakMinutes} min`,
                    ...splitBreaks,
                    notes: "",
                    jobTitle: ts.role || roleLabel,
                };
            }
            const recommendedBreakMinutes = getRecommendedBreakMinutes(scheduledMinutes);
            const splitBreaks = splitBreakMinutes(recommendedBreakMinutes);
            return {
                id: assigned.id,
                name: assigned.name || "Worker Name",
                avatar: assigned.avatarUrl || "",
                initials: assigned.initials,
                shiftDuration: scheduledDurationLabel,
                scheduledMinutes,
                clockIn: "",
                clockOut: "",
                breakDuration: `${recommendedBreakMinutes} min`,
                ...splitBreaks,
                notes: "",
                jobTitle: roleLabel,
            };
        });
    }, [scheduledDurationLabel, scheduledMinutes, shift.assignedWorkers, timesheets]);

    const buildWorkerViewModel = React.useCallback((worker: {
        id: string;
        name: string;
        avatar?: string;
        initials: string;
    }): TimesheetViewModel => {
        const recommendedBreakMinutes = getRecommendedBreakMinutes(scheduledMinutes);
        return {
            id: worker.id,
            name: worker.name,
            avatar: worker.avatar || "",
            initials: worker.initials,
            shiftDuration: scheduledDurationLabel,
            scheduledMinutes,
            clockIn: "",
            clockOut: "",
            breakDuration: `${recommendedBreakMinutes} min`,
            ...splitBreakMinutes(recommendedBreakMinutes),
            notes: "",
            jobTitle: shift.title,
        };
    }, [scheduledDurationLabel, scheduledMinutes, shift.title]);

    const [workers, setWorkers] = React.useState<TimesheetViewModel[]>(getWorkersFromProps);
    const [isAddWorkerOpen, setIsAddWorkerOpen] = React.useState(false);
    const [isCancelConfirmOpen, setIsCancelConfirmOpen] = React.useState(false);
    const [isCancelling, setIsCancelling] = React.useState(false);
    const [noteWorkerId, setNoteWorkerId] = React.useState<string | null>(null);
    const [noteDraft, setNoteDraft] = React.useState("");

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

    React.useEffect(() => {
        setWorkers(getWorkersFromProps());
    }, [getWorkersFromProps]);

    const updateWorker = React.useCallback((id: string, field: string, value: any) => {
        setWorkers((prev) =>
            prev.map((worker) => {
                if (worker.id !== id) {
                    return worker;
                }

                const nextWorker = { ...worker, [field]: value };

                if (field === "breakOneDuration" || field === "breakTwoDuration") {
                    return {
                        ...nextWorker,
                        breakDuration: `${combineBreakDurations(nextWorker)} min`,
                    };
                }

                return nextWorker;
            }),
        );
    }, []);

    const handleAddWorkers = async (newWorkerIds: string[]) => {
        try {
            await import("@/lib/api/shifts").then(mod => mod.assignWorkers(shift.id, newWorkerIds));

            if (isDashboardMockShiftId(shift.id)) {
                const mockCrew = getDashboardMockCrew();
                const addedWorkers = mockCrew
                    .filter((worker) => newWorkerIds.includes(worker.id))
                    .map((worker) => buildWorkerViewModel(worker));

                setWorkers((prev) => {
                    const existingIds = new Set(prev.map((worker) => worker.id));
                    return [
                        ...prev,
                        ...addedWorkers.filter((worker) => !existingIds.has(worker.id)),
                    ];
                });

                toast.success(`Added ${newWorkerIds.length} worker${newWorkerIds.length === 1 ? "" : "s"} to the shift`);
                return;
            }

            toast.success(`Assigned ${newWorkerIds.length} workers successfully`);
            router.refresh();
        } catch (error) {
            console.error(error);
            toast.error("Failed to assign workers");
        }
    };


    const isApproved = shift.status === 'approved';
    const isCancelled = shift.status === 'cancelled';
    const workerCount = workers.length;
    const filledCount = workers.filter((worker) => Boolean(worker.clockIn && worker.clockOut)).length;
    const needsAttentionCount = workers.filter(workerNeedsAttention).length;
    const hasErrors = needsAttentionCount > 0;
    const totalHours = formatTrackedMinutes(
        workers.reduce((total, worker) => total + calculateTrackedMinutes(worker), 0),
    );
    const roleLabel = timesheets[0]?.role || "Event Staff";

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

    const handleEditWorkerNotes = React.useCallback((workerId: string) => {
        const worker = workers.find((candidate) => candidate.id === workerId);
        if (!worker) return;

        setNoteWorkerId(workerId);
        setNoteDraft(worker.notes || "");
    }, [workers]);

    const handleSaveWorkerNotes = React.useCallback(() => {
        if (!noteWorkerId) return;

        updateWorker(noteWorkerId, "notes", noteDraft.trim());
        setNoteWorkerId(null);
        setNoteDraft("");
        toast.success("Manager note saved on this screen");
    }, [noteDraft, noteWorkerId, updateWorker]);

    const handleRemoveWorker = React.useCallback(async (workerId: string) => {
        const worker = workers.find((candidate) => candidate.id === workerId);
        if (!worker) return;

        if (isDashboardMockShiftId(shift.id)) {
            setWorkers((prev) => prev.filter((candidate) => candidate.id !== workerId));
            toast.success(`${worker.name} removed from this shift`);
            return;
        }

        try {
            await import("@/lib/api/shifts").then((mod) => mod.unassignWorker(shift.id, workerId));
            setWorkers((prev) => prev.filter((candidate) => candidate.id !== workerId));
            toast.success(`${worker.name} removed from this shift`);
            router.refresh();
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : "Failed to remove worker from shift");
        }
    }, [router, shift.id, workers]);

    // Auto-save handler (Debounce or onBlur handled by child)
    const saveTimesheetEntry = async (id: string, field: string, value: any) => {
        let action = 'update_time';
        let data: any = {};

        const latestWorker = workers.find(w => w.id === id);
        if (!latestWorker) return;

        try {
            const shiftDate = new Date(shift.startTime); // Base date
            const nextWorkerSnapshot = { ...latestWorker, [field]: value };

            if (field === 'clockIn') {
                data.clockIn = parseTimeStringToIso(value, shiftDate);
                data.clockOut = parseTimeStringToIso(latestWorker.clockOut, shiftDate);
                data.breakMinutes = combineBreakDurations(latestWorker);
            } else if (field === 'clockOut') {
                data.clockIn = parseTimeStringToIso(latestWorker.clockIn, shiftDate);
                data.clockOut = parseTimeStringToIso(value, shiftDate);
                data.breakMinutes = combineBreakDurations(latestWorker);
            } else if (field === 'breakOneDuration' || field === 'breakTwoDuration') {
                data.clockIn = parseTimeStringToIso(latestWorker.clockIn, shiftDate);
                data.clockOut = parseTimeStringToIso(latestWorker.clockOut, shiftDate);
                data.breakMinutes = combineBreakDurations(nextWorkerSnapshot);
            } else {
                return;
            }

            const workerName = workers.find(w => w.id === id)?.name || "Worker";
            const fieldLabel =
                field === "clockIn"
                    ? "Clock In"
                    : field === "clockOut"
                        ? "Clock Out"
                        : field === "breakOneDuration"
                            ? "Break 1"
                            : "Break 2";

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
        <div className="flex flex-col space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to shifts dashboard">
                        <ArrowLeft />
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
                {!isApproved && !isCancelled && (
                    <div className="flex items-center gap-2">
                        <Button variant="outline" className="rounded-full" onClick={() => setIsAddWorkerOpen(true)}>
                            <UserPlus data-icon="inline-start" />
                            Add worker
                        </Button>
                        <AlertDialog open={isCancelConfirmOpen} onOpenChange={setIsCancelConfirmOpen}>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant="ghost"
                                    className="rounded-full px-3 text-muted-foreground hover:text-destructive"
                                >
                                    <X data-icon="inline-start" />
                                    Cancel shift
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Cancel this shift?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will remove the shift from the schedule and notify any assigned workers.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Keep shift</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={handleCancelShift}
                                        disabled={isCancelling}
                                        className="bg-destructive text-white hover:bg-destructive/90"
                                    >
                                        {isCancelling ? "Cancelling..." : "Cancel shift"}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                )}
            </div>
            <Card className="rounded-[28px] border-border/70 shadow-sm">
                <CardContent className="flex flex-col gap-6 p-6">
                    <ShiftSummaryHeader
                        title={shift.title}
                        role={roleLabel}
                        date={format(new Date(shift.startTime), "EEE, MMM d, yyyy")}
                        location={shift.locationName}
                        timeRange={`${format(new Date(shift.startTime), "h:mm a")} - ${format(new Date(shift.endTime), "h:mm a")}`}
                        breakDuration="30 min break"
                        createdBy="Admin"
                        createdAt="Oct 14, 11:37 PM"
                    />

                    {!isCancelled ? (
                        <ShiftApprovalBanner
                            workerCount={workerCount}
                            filledCount={filledCount}
                            needsAttentionCount={needsAttentionCount}
                            totalHours={totalHours}
                            hasErrors={hasErrors}
                            isApproved={isApproved}
                            onApprove={() => onApprove?.()}
                        />
                    ) : null}

                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-lg font-semibold tracking-tight">Team timesheets</h3>
                                <Badge variant="outline">{workerCount} workers</Badge>
                                {needsAttentionCount > 0 ? (
                                    <Badge className="border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-100">
                                        {needsAttentionCount} need review
                                    </Badge>
                                ) : (
                                    <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                                        All records complete
                                    </Badge>
                                )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Managers update clock-in, clock-out, break windows, notes, and removals here before final approval.
                            </p>
                        </div>

                        <TimesheetTable
                            data={workers}
                            onUpdateWorker={updateWorker}
                            onSaveWorker={saveTimesheetEntry}
                            onEditWorkerNotes={handleEditWorkerNotes}
                            onRemoveWorker={handleRemoveWorker}
                            isApproved={isApproved}
                            isCancelled={isCancelled}
                        />
                    </div>
                </CardContent>
            </Card>

            {isAddWorkerOpen ? (
                <AddWorkerDialog
                    isOpen={isAddWorkerOpen}
                    onClose={() => setIsAddWorkerOpen(false)}
                    onConfirm={handleAddWorkers}
                    existingWorkerIds={workers.map(w => w.id)}
                />
            ) : null}

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

            <Dialog open={!!noteWorkerId} onOpenChange={(open) => {
                if (!open) {
                    setNoteWorkerId(null);
                    setNoteDraft("");
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Manager note</DialogTitle>
                        <DialogDescription>
                            Add context for this crew member before the shift is approved.
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea
                        value={noteDraft}
                        onChange={(event) => setNoteDraft(event.target.value)}
                        placeholder="Add a note about breaks, attendance, or follow-up..."
                        className="min-h-[140px]"
                    />
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setNoteWorkerId(null);
                                setNoteDraft("");
                            }}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleSaveWorkerNotes}>Save note</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div >
    );
}
