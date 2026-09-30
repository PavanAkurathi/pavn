"use client";

import { Button } from "@repo/ui/components/ui/button";

/**
 * Appears only when there's something your team can't see yet, so "am I done?"
 * always has an answer. Sits above the phone's tab bar.
 */
export function PublishBar({
    count,
    onPublish,
    onDiscard,
}: {
    count: number;
    onPublish: () => void;
    onDiscard: () => void;
}) {
    if (count === 0) return null;
    return (
        <div
            data-testid="publish-bar"
            className="pointer-events-none fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 px-3 md:bottom-5"
        >
            <div className="pointer-events-auto mx-auto flex max-w-2xl items-center justify-between gap-x-4 gap-y-2 rounded-3xl border bg-card p-2.5 shadow-lg md:px-4 md:py-3">
                <p className="hidden pl-1 text-sm font-medium sm:block" aria-live="polite">
                    <span className="font-semibold">{count === 1 ? "1 change" : `${count} changes`}</span>
                    <span className="text-muted-foreground"> your team can&apos;t see yet</span>
                </p>
                <div className="flex flex-1 items-center gap-2 sm:ml-auto sm:flex-none">
                    <Button type="button" variant="ghost" className="h-11 px-4" onClick={onDiscard}>
                        Discard
                    </Button>
                    <Button type="button" data-testid="publish-button" className="h-11 flex-1 px-6 sm:flex-none" onClick={onPublish}>
                        Publish {count} {count === 1 ? "change" : "changes"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
