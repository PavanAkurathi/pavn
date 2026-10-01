"use client";

import useSWR from "swr";
import { REQUESTS_SUMMARY_KEY, fetchRequestsSummary } from "@/lib/scheduler/client";

/**
 * Requests waiting on a manager, badged on Schedule in both bars. Workers get a
 * 403 and no badge. SWR dedupes, so the two bars share one poll.
 */
export function useRequestsWaiting(enabled: boolean): number {
    const { data } = useSWR(enabled ? REQUESTS_SUMMARY_KEY : null, fetchRequestsSummary, {
        refreshInterval: 60_000,
        shouldRetryOnError: false,
    });
    return data?.pending ?? 0;
}

export function waitingLabel(waiting: number): string {
    return `${waiting} ${waiting === 1 ? "request" : "requests"} waiting`;
}
