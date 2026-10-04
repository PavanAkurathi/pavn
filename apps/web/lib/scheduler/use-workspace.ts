"use client";

import { useMemo } from "react";
import useSWR from "swr";
import type { SchedulerWeek } from "@repo/contracts/scheduler";
import { fetchSchedulerWeek, weekKey } from "./client";
import { ALL_SITES, mergeWeeks, type Site, type Workspace } from "./workspace";

export const workspaceKey = (siteIds: string[], weekStart: string) => ["scheduler-workspace", siteIds.join(","), weekStart] as const;

/** Every site's week, side by side. Few organizations have more than a handful, so one request each. */
function fetchAllWeeks([, ids, weekStart]: ReturnType<typeof workspaceKey>): Promise<SchedulerWeek[]> {
    return Promise.all(ids.split(",").map((id) => fetchSchedulerWeek(weekKey(id, weekStart))));
}

/**
 * The week in view, for the site in scope or all of them. Every site's week is
 * always loaded, so that publishing can say what a site filter leaves out.
 */
export function useWorkspace({
    sites,
    scope,
    weekStart,
    initialWeeks,
    initialWeekStart,
}: {
    sites: Site[];
    /** A site id, or ALL_SITES. */
    scope: string;
    weekStart: string;
    initialWeeks: SchedulerWeek[];
    initialWeekStart: string;
}) {
    const key = workspaceKey(
        sites.map((s) => s.id),
        weekStart,
    );
    const { data, error, isValidating, mutate } = useSWR(key, fetchAllWeeks, {
        fallbackData: weekStart === initialWeekStart ? initialWeeks : undefined,
        keepPreviousData: true,
        revalidateOnFocus: true,
    });
    const weeks = data ?? initialWeeks;

    const workspace: Workspace = useMemo(() => {
        const scoped = scope === ALL_SITES ? sites : sites.filter((s) => s.id === scope);
        const inScope = scoped.length ? scoped : sites;
        const ids = new Set(inScope.map((s) => s.id));
        return mergeWeeks(
            weeks.filter((w) => ids.has(w.location.id)),
            inScope,
        );
    }, [weeks, scope, sites]);

    return { weeks, workspace, error, isValidating, mutate };
}
