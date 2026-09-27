"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { SchedulerBlockingConflict, SchedulerChange } from "@repo/contracts/scheduler";
import { blockingConflictsOf, postSchedulerChanges } from "./client";
import { withoutPeople, type Plan } from "./plans";

interface HistoryEntry {
    label: string;
    changes: SchedulerChange[];
    undo: SchedulerChange[];
}

export interface PendingConflict {
    label: string;
    conflicts: SchedulerBlockingConflict[];
    decide: (scheduleAnyway: boolean) => void;
}

/**
 * Sends grid plans to the server and keeps the session's undo history.
 *
 * Every batch comes back with the changes that undo it, so undo is just
 * another batch, and redo re-sends what was undone. A plan that would
 * double-book someone asks first; bulk plans (copy week, templates) can
 * instead leave those spots open.
 */
export function useSchedulerEdits(refresh: () => Promise<unknown>) {
    const [past, setPast] = useState<HistoryEntry[]>([]);
    const [future, setFuture] = useState<HistoryEntry[]>([]);
    const [busy, setBusy] = useState(false);
    const [conflict, setConflict] = useState<PendingConflict | null>(null);
    const busyRef = useRef(false);

    const ask = (label: string, conflicts: SchedulerBlockingConflict[]) =>
        new Promise<boolean>((resolve) => {
            setConflict({
                label,
                conflicts,
                decide: (yes) => {
                    setConflict(null);
                    resolve(yes);
                },
            });
        });

    const undoRef = useRef<() => Promise<void>>(async () => {});

    const run = useCallback(
        async (plan: Plan, options: { onConflict?: "ask" | "leave-open" } = {}): Promise<boolean> => {
            if (busyRef.current || plan.changes.length === 0) return false;
            busyRef.current = true;
            setBusy(true);
            try {
                let changes = plan.changes;
                let result;
                try {
                    result = await postSchedulerChanges(changes, false);
                } catch (error) {
                    const conflicts = blockingConflictsOf(error);
                    if (!conflicts) throw error;
                    if (options.onConflict === "leave-open") {
                        changes = withoutPeople(changes, conflicts);
                        result = await postSchedulerChanges(changes, false);
                        const names = [...new Set(conflicts.map((c) => c.personName.split(" ")[0]))].join(", ");
                        toast.info(`Left ${conflicts.length} ${conflicts.length === 1 ? "spot" : "spots"} open: ${names} can't work then.`);
                    } else {
                        if (!(await ask(plan.label, conflicts))) return false;
                        result = await postSchedulerChanges(changes, true);
                    }
                }
                setPast((p) => [...p.slice(-49), { label: plan.label, changes, undo: result.undo }]);
                setFuture([]);
                await refresh();
                toast(plan.label, { action: { label: "Undo", onClick: () => void undoRef.current() } });
                return true;
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "That didn't save");
                await refresh();
                return false;
            } finally {
                busyRef.current = false;
                setBusy(false);
            }
        },
        [refresh],
    );

    // Undo and redo restore a state that existed a moment ago, so they don't
    // stop for conflicts that state already had.
    const step = useCallback(
        async (direction: "undo" | "redo") => {
            if (busyRef.current) return;
            const stack = direction === "undo" ? past : future;
            const entry = stack[stack.length - 1];
            if (!entry) return;
            busyRef.current = true;
            setBusy(true);
            try {
                const result = await postSchedulerChanges(direction === "undo" ? entry.undo : entry.changes, true);
                if (direction === "undo") {
                    setPast((p) => p.slice(0, -1));
                    setFuture((f) => [...f, entry]);
                    toast(`Undone: ${entry.label}`);
                } else {
                    setFuture((f) => f.slice(0, -1));
                    setPast((p) => [...p, { ...entry, undo: result.undo }]);
                    toast(`Redone: ${entry.label}`);
                }
                await refresh();
            } catch (error) {
                toast.error(error instanceof Error ? `Couldn't ${direction}: ${error.message}` : `Couldn't ${direction}`);
                await refresh();
            } finally {
                busyRef.current = false;
                setBusy(false);
            }
        },
        [past, future, refresh],
    );

    useEffect(() => {
        undoRef.current = () => step("undo");
    }, [step]);

    const reset = useCallback(() => {
        setPast([]);
        setFuture([]);
    }, []);

    return {
        run,
        undo: () => step("undo"),
        redo: () => step("redo"),
        canUndo: past.length > 0,
        canRedo: future.length > 0,
        nextUndoLabel: past[past.length - 1]?.label,
        busy,
        conflict,
        reset,
    };
}
