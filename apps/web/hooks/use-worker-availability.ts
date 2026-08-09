import useSWR from "swr";
import { useMemo } from "react";
import { fetcher } from "@/lib/fetcher";
import { useOrganizationId } from "./use-schedule-data";

/**
 * Worker availability for a date window, keyed by worker id.
 *
 * publish() already rejects an assignment that collides with a worker's
 * unavailability (see publish.ts, AVAILABILITY_CONFLICT), but the manager only
 * found out after committing the whole schedule. The same data was visible in
 * the product — on each worker's detail page — just not at the moment of
 * choosing. This surfaces it in the picker so the rejection becomes guidance.
 */
export interface AvailabilityWindow {
    workerId: string;
    startTime: string;
    endTime: string;
    type: string;
}

export function useWorkerAvailability(from?: string, to?: string) {
    const orgId = useOrganizationId();

    const key = orgId && from && to
        ? `/api/organizations/${orgId}/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
        : null;

    const { data, isLoading } = useSWR<AvailabilityWindow[]>(key, fetcher);

    const byWorker = useMemo(() => {
        const map = new Map<string, AvailabilityWindow[]>();
        for (const row of data || []) {
            // Only blocks matter here. The schema also carries positive
            // "available" windows, and treating those as conflicts would flag
            // exactly the workers who told you they *can* work.
            if (row.type !== "unavailable") continue;
            const list = map.get(row.workerId) || [];
            list.push(row);
            map.set(row.workerId, list);
        }
        return map;
    }, [data]);

    return { availabilityByWorker: byWorker, isLoading };
}

/**
 * Whether a worker has blocked off any part of [start, end).
 * Overlap test matches publish.ts so the picker and the server agree.
 */
export function isUnavailableDuring(
    windows: AvailabilityWindow[] | undefined,
    start: Date,
    end: Date,
) {
    if (!windows?.length) return false;
    return windows.some((w) => new Date(w.startTime) < end && new Date(w.endTime) > start);
}
