import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/ui/alert";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { AlertCircle, CheckCircle2 } from "lucide-react";

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
    const Icon = isApproved || !hasErrors ? CheckCircle2 : AlertCircle;

    return (
        <Alert
            className={cn(
                "rounded-2xl border px-5 py-4 shadow-none",
                isApproved && "border-border/70 bg-muted/30",
                !isApproved && "bg-background",
            )}
        >
            <Icon className={cn(isApproved && "text-primary", hasErrors && !isApproved && "text-destructive")} />
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <AlertTitle>{title}</AlertTitle>
                        <Badge variant={isApproved ? "secondary" : hasErrors ? "destructive" : "outline"}>
                            {isApproved ? "Approved" : hasErrors ? "Needs review" : "Ready"}
                        </Badge>
                        <Badge variant="outline">{filledCount}/{workerCount} complete</Badge>
                        <Badge variant="outline">{totalHours} tracked</Badge>
                    </div>
                    <AlertDescription className="max-w-2xl">
                        {description}
                    </AlertDescription>
                </div>

                {isApproved ? (
                    <Button variant="outline" className="self-start" disabled>
                        Archived
                    </Button>
                ) : (
                    <Button
                        className="self-start"
                        disabled={hasErrors}
                        onClick={onApprove}
                    >
                        Approve shift
                    </Button>
                )}
            </div>
        </Alert>
    );
}
