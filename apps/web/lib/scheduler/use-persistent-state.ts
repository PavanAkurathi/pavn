"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A per-browser preference (a filter, a view, collapsed sections). It renders
 * the fallback on the server and first paint, then the stored value, without a
 * hydration mismatch. Storage can be missing or blocked, in which case the
 * preference simply isn't remembered.
 */

const EVENT = "wh:persistent-state";
// Holds values when storage is blocked, so a choice still applies for this visit.
const memory = new Map<string, string>();

function read(key: string): string | null {
    try {
        return window.localStorage.getItem(key) ?? memory.get(key) ?? null;
    } catch {
        return memory.get(key) ?? null;
    }
}

function subscribe(onChange: () => void) {
    window.addEventListener("storage", onChange);
    window.addEventListener(EVENT, onChange);
    return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener(EVENT, onChange);
    };
}

export function usePersistentState<T extends string>(
    key: string,
    fallback: T,
    isValid: (value: string) => value is T = (value): value is T => Boolean(value),
): [T, (next: T) => void] {
    const stored = useSyncExternalStore(subscribe, () => read(key), () => null);
    const value = stored !== null && isValid(stored) ? stored : fallback;

    const set = useCallback(
        (next: T) => {
            memory.set(key, next);
            try {
                window.localStorage.setItem(key, next);
            } catch {
                // Not remembered across visits; the in-memory copy still applies.
            }
            window.dispatchEvent(new Event(EVENT));
        },
        [key],
    );

    return [value, set];
}
