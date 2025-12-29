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

interface ExitDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    onDiscard: () => void;
}

export function ExitDialog({
    isOpen,
    onClose,
    onSave,
    onDiscard,
}: ExitDialogProps) {
    return (
        <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Save progress?</AlertDialogTitle>
                    <AlertDialogDescription>
                        You have unsaved changes. Do you want to save them as a draft and
                        finish later?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="sm:justify-between gap-2">
                    <div className="flex justify-start w-full sm:w-auto">
                        <AlertDialogCancel onClick={onDiscard} className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
                            Discard
                        </AlertDialogCancel>
                    </div>
                    <div className="flex gap-2">
                        <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={onSave}>Save & Exit</AlertDialogAction>
                    </div>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
