"use client";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@repo/ui/components/ui/alert-dialog";
import type { PendingConflict } from "@/lib/scheduler/use-scheduler-edits";

export function ConflictDialog({ conflict }: { conflict: PendingConflict | null }) {
    return (
        <AlertDialog open={conflict !== null} onOpenChange={(open) => !open && conflict?.decide(false)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {conflict && conflict.conflicts.length > 1 ? "These people can't work then" : "They can't work then"}
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="flex flex-col gap-2 text-sm">
                            <ul className="flex flex-col gap-1.5">
                                {conflict?.conflicts.map((c) => (
                                    <li key={`${c.shiftId}-${c.personId}`}>
                                        <span className="font-medium text-foreground">{c.personName}</span>
                                        <span className="text-destructive">: {c.messages.join("; ")}</span>
                                    </li>
                                ))}
                            </ul>
                            <p>Scheduling anyway is recorded in the audit log.</p>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => conflict?.decide(false)}>Don&apos;t</AlertDialogCancel>
                    <AlertDialogAction onClick={() => conflict?.decide(true)}>Schedule anyway</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
