"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Button } from "@repo/ui/components/ui/button";
import { ArrowLeft, UserPlus, X } from "lucide-react";
import { Card, CardContent, CardHeader } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Separator } from "@repo/ui/components/ui/separator";

import { ShiftSummaryHeader } from "./timesheet/shift-summary-header";
import { ShiftApprovalBanner } from "./timesheet/shift-approval-banner";
import { TimesheetTable } from "./timesheet/timesheet-table";
import type { AddWorkerSelection } from "./add-worker-dialog";

import { Shift, TimesheetWorker } from "@/lib/types";
import { addDays, differenceInMinutes, format } from "date-fns";
import { toast } from "sonner";
import {
    calculateTrackedMinutes,
    combineBreakDurations,
    formatTrackedMinutes,
    getRecommendedBreakMinutes,
    isClockOutNextDay,
    parseTimeStringToIso,
    splitBreakMinutes,
    UpdateTimesheetPayload,
    TimesheetViewModel,
    workerNeedsAttention,
} from "@/lib/timesheet-utils";
import {
    assignWorkersToShiftAction,
    cancelShiftAction,
    unassignWorkerFromShiftAction,
    updateTimesheetAction,
} from "../_actions/timesheet";

const AddWorkerDialog = dynamic(
    () => import("./add-worker-dialog").then((mod) => mod.AddWorkerDialog),
    { ssr: false },
);

interface ShiftDetailViewProps {
    onBack: () => void;
    shift: Shift;
    timesheets: TimesheetWorker[];
    onApprove?: () => void;
}

export function ShiftDetailView({ onBack, shift, timesheets, onApprove }: ShiftDetailViewProps) {
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

    const buildWorkerViewModel = React.useCallback((worker: AddWorkerSelection): TimesheetViewModel => {
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

    const [workers, setWorkers] = React.useState<TimesheetViewModel[]>(() => getWorkersFromProps());
    const [isAddWorkerOpen, setIsAddWorkerOpen] = React.useState(false);
    const [isCancelling, setIsCancelling] = React.useState(false);

    const updateWorkerNotes = React.useCallback((id: string, value: string) => {
        setWorkers((prev) =>
            prev.map((worker) => {
                if (worker.id !== id) {
                    return worker;
                }

                return { ...worker, notes: value };
            }),
        );
    }, []);

    const handleAddWorkers = async (newWorkers: AddWorkerSelection[]) => {
        const newWorkerIds = newWorkers.map((worker) => worker.id);

        try {
            const result = await assignWorkersToShiftAction(shift.id, newWorkerIds);
            if ("error" in result) {
                throw new Error(result.error);
            }

            const addedWorkers = newWorkers.map((worker) => buildWorkerViewModel(worker));
            setWorkers((prev) => {
                const existingIds = new Set(prev.map((worker) => worker.id));
                return [...prev, ...addedWorkers.filter((worker) => !existingIds.has(worker.id))];
            });

            toast.success(`Added ${newWorkerIds.length} worker${newWorkerIds.length === 1 ? "" : "s"} to the shift`);
        } catch (error) {
            console.error(error);
            toast.error("Failed to assign workers");
        }
    };

    const isApproved = shift.status === "approved";
    const isCancelled = shift.status === "cancelled";
    const workerCount = workers.length;
    const filledCount = workers.filter((worker) => Boolean(worker.clockIn && worker.clockOut)).length;
    const needsAttentionCount = workers.filter(workerNeedsAttention).length;
    const hasErrors = needsAttentionCount > 0;
    const totalHours = formatTrackedMinutes(
        workers.reduce((total, worker) => total + calculateTrackedMinutes(worker), 0),
    );
    const roleLabel = timesheets[0]?.role || "Event Staff";
    const summaryBreakLabel = `${getRecommendedBreakMinutes(scheduledMinutes)} min break`;

    const handleRemoveWorker = React.useCallback(async (workerId: string) => {
        const worker = workers.find((candidate) => candidate.id === workerId);
        if (!worker) return;

        try {
            const result = await unassignWorkerFromShiftAction(shift.id, workerId);
            if ("error" in result) {
                throw new Error(result.error);
            }

            setWorkers((prev) => prev.filter((candidate) => candidate.id !== workerId));
            toast.success(`${worker.name} removed from this shift`);
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : "Failed to remove worker from shift");
        }
    }, [shift.id, workers]);

    const commitWorkerChanges = React.useCallback(async (
        id: string,
        changes: Partial<Pick<TimesheetViewModel, "clockIn" | "clockOut" | "breakOneDuration" | "breakTwoDuration">>,
    ) => {
        const latestWorker = workers.find((worker) => worker.id === id);
        if (!latestWorker) return false;

        try {
            const shiftDate = new Date(shift.startTime);
            const nextWorkerSnapshot = {
                ...latestWorker,
                ...changes,
            };
            const breakMinutes = combineBreakDurations(nextWorkerSnapshot);
            const clockOutBaseDate = isClockOutNextDay(
                nextWorkerSnapshot.clockIn,
                nextWorkerSnapshot.clockOut,
            )
                ? addDays(shiftDate, 1)
                : shiftDate;

            const payload: UpdateTimesheetPayload = {
                clockIn: parseTimeStringToIso(nextWorkerSnapshot.clockIn, shiftDate),
                clockOut: parseTimeStringToIso(nextWorkerSnapshot.clockOut, clockOutBaseDate),
                breakMinutes,
            };

            if (!payload.clockIn && !payload.clockOut && breakMinutes === combineBreakDurations(latestWorker)) {
                return true;
            }

            const result = await updateTimesheetAction(shift.id, id, payload);
            if ("error" in result) {
                throw new Error(result.error);
            }

            setWorkers((prev) =>
                prev.map((worker) =>
                    worker.id === id
                        ? {
                              ...worker,
                              ...changes,
                              breakDuration: `${breakMinutes} min`,
                          }
                        : worker,
                ),
            );

            return true;
        } catch (error) {
            console.error(error);
            toast.error("Failed to save timesheet");
            return false;
        }
    }, [shift.id, shift.startTime, workers]);

    const handleCancelShift = async () => {
        if (!window.confirm("Cancel this shift and notify assigned workers?")) {
            return;
        }

        setIsCancelling(true);
        try {
            const result = await cancelShiftAction(shift.id);
            if ("error" in result) {
                throw new Error(result.error);
            }

            toast.success("Shift cancelled successfully");
            onBack();
        } catch (error) {
            console.error(error);
            toast.error("Failed to cancel shift");
        } finally {
            setIsCancelling(false);
        }
    };

    return (
        <div className="flex flex-col space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-4">
                    <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to shifts dashboard">
                        <ArrowLeft />
                    </Button>
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-2xl font-semibold tracking-tight">Timesheets</h2>
                            {isApproved ? <Badge variant="secondary">Approved</Badge> : null}
                            {isCancelled ? <Badge variant="destructive">Cancelled</Badge> : null}
                            {!isApproved && !isCancelled ? (
                                <Badge variant="outline">
                                    {filledCount} of {workerCount} filled
                                </Badge>
                            ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Review worker time entries, break windows, and notes before approval.
                        </p>
                    </div>
                </div>
                {!isApproved && !isCancelled && (
                    <div className="flex items-center gap-2 self-start">
                        <Button variant="outline" onClick={() => setIsAddWorkerOpen(true)}>
                            <UserPlus data-icon="inline-start" />
                            Add worker
                        </Button>
                        <Button
                            variant="ghost"
                            className="px-3 text-muted-foreground hover:text-destructive"
                            onClick={handleCancelShift}
                            disabled={isCancelling}
                        >
                            <X data-icon="inline-start" />
                            {isCancelling ? "Cancelling..." : "Cancel shift"}
                        </Button>
                    </div>
                )}
            </div>
            <Card className="rounded-[24px] border-border/70 shadow-sm">
                <CardHeader className="gap-5 p-5 md:p-6">
                    <ShiftSummaryHeader
                        title={shift.title}
                        role={roleLabel}
                        date={format(new Date(shift.startTime), "EEE, MMM d, yyyy")}
                        location={shift.locationName}
                        timeRange={`${format(new Date(shift.startTime), "h:mm a")} - ${format(new Date(shift.endTime), "h:mm a")}`}
                        breakDuration={summaryBreakLabel}
                        createdBy="Admin"
                        createdAt="Oct 14, 11:37 PM"
                    />

                    {!isCancelled ? (
                        <>
                            <Separator />
                            <ShiftApprovalBanner
                                workerCount={workerCount}
                                filledCount={filledCount}
                                needsAttentionCount={needsAttentionCount}
                                totalHours={totalHours}
                                hasErrors={hasErrors}
                                isApproved={isApproved}
                                onApprove={() => onApprove?.()}
                            />
                        </>
                    ) : null}
                </CardHeader>

                <CardContent className="flex flex-col gap-4 px-5 pb-5 pt-0 md:px-6 md:pb-6">
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-lg font-semibold tracking-tight">Team timesheets</h3>
                                <Badge variant="outline">{workerCount} workers</Badge>
                                {needsAttentionCount > 0 ? (
                                    <Badge variant="destructive">
                                        {needsAttentionCount} need review
                                    </Badge>
                                ) : (
                                    <Badge variant="secondary">
                                        All records complete
                                    </Badge>
                                )}
                            </div>
                            <p className="max-w-xl text-sm text-muted-foreground">
                                Update time entries, break windows, notes, and removals here before final approval.
                            </p>
                        </div>

                        <TimesheetTable
                            data={workers}
                            onCommitWorker={commitWorkerChanges}
                            onUpdateWorkerNotes={updateWorkerNotes}
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
                    existingWorkerIds={workers.map((worker) => worker.id)}
                />
            ) : null}
        </div>
    );
}
