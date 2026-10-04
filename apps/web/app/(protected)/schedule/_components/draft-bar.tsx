"use client";

import { useEffect, useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import type { PublishPhase } from "@/lib/scheduler/use-publish";

/** How long a first tap on Discard stays armed. */
const CONFIRM_WINDOW_MS = 2600;

/**
 * What staff can't see yet, with the two things to do about it. Discard takes
 * two taps; Publish is the toolbar's one-click publish, undo window and all.
 */
export function DraftBar({
    count,
    publishPhase,
    onPublish,
    onDiscard,
}: {
    count: number;
    publishPhase: PublishPhase;
    onPublish: () => void;
    onDiscard: () => void;
}) {
    const [armed, setArmed] = useState(false);

    useEffect(() => {
        if (!armed) return;
        const timer = window.setTimeout(() => setArmed(false), CONFIRM_WINDOW_MS);
        return () => window.clearTimeout(timer);
    }, [armed]);

    return (
        <div
            role="status"
            className="mx-3.5 my-2.5 flex flex-wrap items-center gap-3 rounded-[14px] border-[1.5px] border-dashed border-border bg-muted/30 px-4 py-2.5"
        >
            <span aria-hidden className="size-[9px] shrink-0 rounded-full bg-foreground/80" />
            <p className="min-w-[200px] flex-1 text-[13.5px]">
                <b className="font-extrabold">
                    {count} unpublished {count === 1 ? "change" : "changes"}
                </b>{" "}
                · staff can&apos;t see {count === 1 ? "it" : "them"} until you publish.
            </p>
            <Button
                variant="outline"
                size="sm"
                className={`font-bold ${armed ? "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:text-destructive-foreground" : "text-muted-foreground"}`}
                disabled={publishPhase !== "idle"}
                onClick={() => {
                    if (!armed) {
                        setArmed(true);
                        return;
                    }
                    setArmed(false);
                    onDiscard();
                }}
            >
                {armed ? "Confirm?" : "Discard"}
            </Button>
            <Button size="sm" className="font-bold" disabled={publishPhase !== "idle"} onClick={onPublish}>
                {publishPhase === "idle" ? "Publish" : "Publishing…"}
            </Button>
        </div>
    );
}
