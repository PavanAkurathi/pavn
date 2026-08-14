"use client";

import * as React from "react";
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

type ConfirmOptions = {
    title: string;
    description?: string;
    /** Defaults to "Continue". */
    confirmLabel?: string;
    cancelLabel?: string;
    /** Styles the action as destructive. */
    destructive?: boolean;
};

/**
 * A confirm() that does not freeze the browser.
 *
 * The native window.confirm halts the renderer until it is dismissed: the tab
 * stops responding to scrolling, to its own scripts, to everything, which reads
 * as a crash. This returns the same promise-shaped answer without blocking.
 *
 *   const { confirm, confirmDialog } = useConfirm();
 *   if (!(await confirm({ title: "Remove this worker?" }))) return;
 *   // ...and render {confirmDialog} once in the component
 */
export function useConfirm() {
    const [options, setOptions] = React.useState<ConfirmOptions | null>(null);
    const resolverRef = React.useRef<((answer: boolean) => void) | null>(null);

    const confirm = React.useCallback((next: ConfirmOptions) => {
        setOptions(next);
        return new Promise<boolean>((resolve) => {
            resolverRef.current = resolve;
        });
    }, []);

    const settle = React.useCallback((answer: boolean) => {
        resolverRef.current?.(answer);
        resolverRef.current = null;
        setOptions(null);
    }, []);

    const confirmDialog = (
        <AlertDialog
            open={options !== null}
            onOpenChange={(open) => {
                // Dismissing by escape or overlay is a "no".
                if (!open) settle(false);
            }}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{options?.title}</AlertDialogTitle>
                    {options?.description ? (
                        <AlertDialogDescription>{options.description}</AlertDialogDescription>
                    ) : null}
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => settle(false)}>
                        {options?.cancelLabel ?? "Cancel"}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => settle(true)}
                        className={options?.destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
                    >
                        {options?.confirmLabel ?? "Continue"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );

    return { confirm, confirmDialog };
}
