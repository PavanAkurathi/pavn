import * as React from "react";
import { Button } from "@repo/ui/components/ui/button";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
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

interface ShiftApprovalFooterProps {
    workerCount: number;
    filledCount: number;
    totalHours: string;
    totalCost: string;
    hasErrors: boolean;
    isApproved?: boolean;
    onApprove: () => void;
}

export function ShiftApprovalFooter({
    workerCount,
    filledCount,
    totalHours,
    totalCost,
    hasErrors,
    isApproved = false,
    onApprove,
}: ShiftApprovalFooterProps) {
    if (isApproved) {
        return (
            <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-muted/40 p-4 backdrop-blur-sm">
                <div className="mx-auto flex max-w-7xl items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-medium text-green-900">Shift Approved</span>
                            <span className="text-xs text-muted-foreground">
                                Timesheets finalized and sent to payroll
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-8">
                        <div className="hidden flex-col md:flex md:text-right">
                            <span className="text-xs text-muted-foreground">Final Cost</span>
                            <span className="font-mono font-medium">{totalCost}</span>
                        </div>
                        <Button variant="outline" className="rounded-full pointer-events-none opacity-80">
                            Archived
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
                {/* Status Indicator */}
                <div className="flex items-center gap-3">
                    <div
                        className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-full",
                            hasErrors ? "bg-destructive/10" : "bg-green-100"
                        )}
                    >
                        {hasErrors ? (
                            <AlertCircle className="h-5 w-5 text-destructive" />
                        ) : (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                        )}
                    </div>
                    <div className="flex flex-col">
                        <span className="font-medium">
                            {hasErrors ? "Action Required" : "Ready to Approve"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {filledCount} of {workerCount} timesheets filled
                        </span>
                    </div>
                </div>

                {/* Financial Summary */}
                <div className="flex items-center justify-between gap-8 md:justify-end">
                    <div className="flex flex-col md:text-right">
                        <span className="text-xs text-muted-foreground">Total Hours</span>
                        <span className="font-mono font-medium">{totalHours}</span>
                    </div>
                    <div className="flex flex-col md:text-right">
                        <span className="text-xs text-muted-foreground">Est. Cost</span>
                        <span className="font-mono font-medium">{totalCost}</span>
                    </div>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                size="lg"
                                className={cn(
                                    "px-8 font-semibold transition-all",
                                    hasErrors ? "opacity-50" : "hover:scale-105"
                                )}
                                disabled={hasErrors}
                            >
                                Approve Shift
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Approve Shift Timesheet?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will finalize the timesheets for {workerCount} workers.
                                    Total estimated cost is {totalCost}. This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={onApprove} className="bg-green-600 hover:bg-green-700">
                                    Approve Shift
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>
        </div>
    );
}
