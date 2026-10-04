"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { SchedulerPublishPreview, SchedulerWeek } from "@repo/contracts/scheduler";
import { fetchPublishPreview, publishWeek } from "./client";

/** How long "Undo" works. Nobody is messaged until it has run out. */
export const UNDO_WINDOW_MS = 8000;

export type PublishPhase = "idle" | "checking" | "waiting" | "sending";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Publish in one click.
 *
 * Staff are messaged the moment a week is published and that can't be taken
 * back, so "undo" here means a short wait: the toast says what is about to go
 * out and holds it for UNDO_WINDOW_MS, and Undo simply doesn't send. If
 * anything is still wrong (a double booking, approved time off) the one-click
 * path stops and the full preview opens instead, so a problem is never
 * published by accident.
 */
export function usePublish({
    week,
    onNeedsReview,
    onPublished,
}: {
    /** Only the target is read, so a Drafts group can publish its week without loading it. */
    week: Pick<SchedulerWeek, "weekStart"> & { location: Pick<SchedulerWeek["location"], "id"> };
    /** Something is still wrong: open the preview. */
    onNeedsReview: () => void;
    /** Staff have been told: refresh. */
    onPublished: () => Promise<unknown>;
}) {
    const [phase, setPhase] = useState<PublishPhase>("idle");
    const timer = useRef<number | null>(null);
    const toastId = useRef<string | number | null>(null);
    const target = useRef<{ locationId: string; weekStart: string } | null>(null);
    const onPublishedRef = useRef(onPublished);
    useEffect(() => {
        onPublishedRef.current = onPublished;
    }, [onPublished]);

    const clear = useCallback(() => {
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = null;
        if (toastId.current !== null) toast.dismiss(toastId.current);
        toastId.current = null;
    }, []);

    const send = useCallback(async () => {
        const t = target.current;
        timer.current = null;
        target.current = null;
        if (!t) return;
        setPhase("sending");
        try {
            const result = await publishWeek(t.locationId, t.weekStart, false);
            await onPublishedRef.current();
            toast.success(
                result.notify.length ? `Published. ${plural(result.notify.length, "person", "people")} notified.` : "Published.",
            );
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Couldn't publish");
        } finally {
            setPhase("idle");
        }
    }, []);

    const cancel = useCallback(
        (reason?: string) => {
            if (timer.current === null) return;
            clear();
            target.current = null;
            setPhase("idle");
            if (reason) toast(reason);
        },
        [clear],
    );

    const start = useCallback(async () => {
        if (phase !== "idle") return;
        setPhase("checking");
        let preview: SchedulerPublishPreview;
        try {
            preview = await fetchPublishPreview(["scheduler-publish-preview", week.location.id, week.weekStart] as const);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Couldn't check the week");
            setPhase("idle");
            return;
        }

        const changes = preview.newShifts + preview.changedShifts + preview.removedShifts;
        if (changes === 0) {
            toast("Nothing to publish. Staff already see this week as it is.");
            setPhase("idle");
            return;
        }
        if (preview.conflicts.length > 0) {
            setPhase("idle");
            onNeedsReview();
            return;
        }

        target.current = { locationId: week.location.id, weekStart: week.weekStart };
        setPhase("waiting");
        const who = preview.notify.length
            ? `${plural(preview.notify.length, "person", "people")} get one message each`
            : "nobody needs a message";
        toastId.current = toast(`Publishing ${plural(changes, "change")}: ${who}.`, {
            duration: UNDO_WINDOW_MS,
            action: { label: "Undo", onClick: () => cancel("Not published. Your changes are still drafts.") },
        });
        timer.current = window.setTimeout(() => void send(), UNDO_WINDOW_MS);
    }, [phase, week.location.id, week.weekStart, onNeedsReview, cancel, send]);

    // Leaving while it is waiting: send it now rather than lose a publish the manager asked for.
    useEffect(
        () => () => {
            if (timer.current !== null) {
                window.clearTimeout(timer.current);
                void send();
            }
        },
        [send],
    );

    // Closing the tab inside the window would drop it: ask first.
    useEffect(() => {
        if (phase !== "waiting") return;
        const warn = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [phase]);

    return { phase, start, cancel };
}
