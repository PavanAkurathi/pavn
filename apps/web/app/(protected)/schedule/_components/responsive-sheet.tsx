"use client";

import { useRef } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@repo/ui/components/ui/sheet";
import { cn } from "@repo/ui/lib/utils";
import { useIsPhone } from "@/lib/scheduler/use-is-phone";

/**
 * A panel that slides up from the bottom on a phone, where a thumb reaches it,
 * and in from the right on a bigger screen.
 */
export function ResponsiveSheet({
    open,
    onOpenChange,
    title,
    description,
    testId,
    focusFirstField = false,
    children,
    footer,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: React.ReactNode;
    description?: React.ReactNode;
    testId?: string;
    /** Move the cursor into the first field on open (right for "type a time", wrong for a list: it would raise the phone keyboard). */
    focusFirstField?: boolean;
    children: React.ReactNode;
    footer?: React.ReactNode;
}) {
    const phone = useIsPhone();
    const contentRef = useRef<HTMLDivElement>(null);
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                ref={contentRef}
                side={phone ? "bottom" : "right"}
                data-testid={testId}
                onOpenAutoFocus={
                    focusFirstField
                        ? undefined
                        : (event) => {
                              // Focus the panel itself so keyboard and screen-reader users land inside it.
                              event.preventDefault();
                              contentRef.current?.focus();
                          }
                }
                className={cn(
                    "flex flex-col gap-0 overflow-hidden p-0 focus:outline-none",
                    phone ? "max-h-[92dvh] rounded-t-3xl" : "w-full sm:max-w-md",
                )}
            >
                {phone ? <span aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-border" /> : null}
                <SheetHeader className="gap-1 px-5 pb-3 pt-4 pr-12 text-left md:pt-5">
                    <SheetTitle className="text-xl font-semibold tracking-tight">{title}</SheetTitle>
                    {description ? <SheetDescription className="text-sm">{description}</SheetDescription> : <SheetDescription className="sr-only">Details</SheetDescription>}
                </SheetHeader>
                <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 pb-6 pt-1">{children}</div>
                {footer ? <div className="border-t bg-background px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div> : null}
            </SheetContent>
        </Sheet>
    );
}
