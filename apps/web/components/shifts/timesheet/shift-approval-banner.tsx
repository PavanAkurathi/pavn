import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { AlertCircle, CheckCircle2 } from "lucide-react";
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

interface ShiftApprovalBannerProps {
    workerCount: number;
    filledCount: number;
    needsAttentionCount: number;
    totalHours: string;
    hasErrors: boolean;
    isApproved?: boolean;
    onApprove: () => void;
}

export function ShiftApprovalBanner({
    workerCount,
    filledCount,
    needsAttentionCount,
    totalHours,
    hasErrors,
    isApproved = false,
    onApprove,
}: ShiftApprovalBannerProps) {
    const title = isApproved
        ? "Shift approved"
        : hasErrors
          ? "Timesheets need review"
          : "Ready to approve";
    const description = isApproved
        ? "Timesheets are finalized and this shift is ready for payroll history."
        : hasErrors
          ? `${needsAttentionCount} of ${workerCount} worker records still need clock or break updates before approval.`
          : `${filledCount} of ${workerCount} worker records are complete and ready to be finalized.`;

    return (
        <div
            className={cn(
                "rounded-2xl border px-5 py-4 shadow-sm",
                isApproved && "border-emerald-200 bg-emerald-50/80",
                !isApproved && hasErrors && "border-amber-200 bg-amber-50/80",
                !isApproved && !hasErrors && "border-slate-200 bg-slate-50/80",
            )}
        >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                    <div
                        className={cn(
                            "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                            isApproved && "bg-emerald-100 text-emerald-700",
                            !isApproved && hasErrors && "bg-amber-100 text-amber-700",
                            !isApproved && !hasErrors && "bg-slate-900 text-white",
                        )}
                    >
                        {isApproved ? (
                            <CheckCircle2 className="h-5 w-5" />
                        ) : hasErrors ? (
                            <AlertCircle className="h-5 w-5" />
                        ) : (
                            <CheckCircle2 className="h-5 w-5" />
                        )}
                    </div>
                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">{title}</p>
                            <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border/60">
                                {filledCount}/{workerCount} complete
                            </span>
                            <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border/60">
                                {totalHours} tracked
                            </span>
                        </div>
                        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
                    </div>
                </div>

                {isApproved ? (
                    <Button variant="outline" className="rounded-full self-start pointer-events-none opacity-80">
                        Archived
                    </Button>
                ) : (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                className={cn(
                                    "rounded-full px-5 font-semibold self-start",
                                    hasErrors && "pointer-events-none opacity-60",
                                )}
                                disabled={hasErrors}
                            >
                                Approve shift
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Approve this shift?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will finalize the timesheets for {workerCount} workers and move the shift into approved history.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={onApprove} className="bg-green-600 hover:bg-green-700">
                                    Approve shift
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </div>
        </div>
    );
}
