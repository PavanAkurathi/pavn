"use client";

import { useMemo, useRef, useState } from "react";
import useSWR from "swr";
import type { SchedulerWeek } from "@repo/contracts/scheduler";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { fetchSchedulerWeek, weekKey } from "@/lib/scheduler/client";
import { addDays } from "@/lib/scheduler/format";
import { usePersistentState } from "@/lib/scheduler/use-persistent-state";
import { ALL_DEPARTMENTS, buildPeopleView, buildPositionsView, type ViewMode } from "@/lib/scheduler/view-model";
import { getSchedulerHref } from "@/lib/routes";
import { HelpDialog } from "./help-dialog";
import { SchedulerToolbar } from "./scheduler-toolbar";
import { PeopleGrid, PositionsGrid } from "./week-grid";

const isViewMode = (value: string): value is ViewMode => value === "people" || value === "positions";

export function Scheduler({
    orgId,
    locations,
    initialWeek,
    initialLocationId,
    initialWeekParam,
}: {
    orgId: string;
    locations: { id: string; name: string }[];
    initialWeek: SchedulerWeek;
    initialLocationId: string;
    /** The ?week= the page was opened with; null means "this week". */
    initialWeekParam: string | null;
}) {
    const [locationId, setLocationId] = useState(initialLocationId);
    const [weekParam, setWeekParam] = useState<string | null>(initialWeekParam);
    const [search, setSearch] = useState("");
    const [helpOpen, setHelpOpen] = useState(false);
    const [flashOpen, setFlashOpen] = useState(false);
    const openRowRef = useRef<HTMLDivElement | null>(null);

    const key = weekKey(locationId, weekParam);
    const isInitial = locationId === initialLocationId && weekParam === initialWeekParam;
    const { data, error, isValidating, mutate } = useSWR(key, fetchSchedulerWeek, {
        fallbackData: isInitial ? initialWeek : undefined,
        keepPreviousData: true,
        revalidateOnFocus: true,
    });
    const week = data ?? initialWeek;

    const [storedDepartment, setDepartment] = usePersistentState<string>(`wh.scheduler.${orgId}.department`, ALL_DEPARTMENTS);
    const department =
        storedDepartment === ALL_DEPARTMENTS || week.departments.some((d) => d.id === storedDepartment)
            ? storedDepartment
            : ALL_DEPARTMENTS;
    const [viewMode, setViewMode] = usePersistentState<ViewMode>(
        `wh.scheduler.${orgId}.view`,
        week.settings.scheduleStyle === "events" ? "positions" : "people",
        isViewMode,
    );
    const [collapsedRaw, setCollapsedRaw] = usePersistentState<string>(`wh.scheduler.${orgId}.collapsed`, "");
    const collapsed = useMemo(() => new Set(collapsedRaw.split(",").filter(Boolean)), [collapsedRaw]);

    const people = useMemo(() => new Map(week.people.map((p) => [p.id, p])), [week.people]);
    const peopleView = useMemo(() => buildPeopleView(week, { department, search }), [week, department, search]);
    const positionRows = useMemo(() => buildPositionsView(week, { department }), [week, department]);

    // The URL follows the view so a week can be shared or reloaded, without a
    // server round trip: the native History API keeps Next's router in sync.
    const syncUrl = (next: { location: string; week: string | null }) => {
        window.history.replaceState(
            null,
            "",
            getSchedulerHref({
                location: locations.length > 1 || next.location !== locations[0]?.id ? next.location : undefined,
                week: next.week ?? undefined,
            }),
        );
    };

    const goToWeek = (next: string | null) => {
        setWeekParam(next);
        syncUrl({ location: locationId, week: next });
    };

    const changeLocation = (next: string) => {
        setLocationId(next);
        syncUrl({ location: next, week: weekParam });
    };

    const showOpenRow = () => {
        if (viewMode !== "people") setViewMode("people");
        requestAnimationFrame(() => {
            openRowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
            setFlashOpen(true);
            window.setTimeout(() => setFlashOpen(false), 1400);
        });
    };

    const toggleSection = (id: string) => {
        const next = new Set(collapsed);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setCollapsedRaw([...next].join(","));
    };

    return (
        <div className="flex flex-col gap-3">
            <SchedulerToolbar
                week={week}
                locations={locations}
                locationId={locationId}
                onLocation={changeLocation}
                onWeek={(step) => goToWeek(addDays(week.weekStart, step * 7))}
                onThisWeek={() => goToWeek(null)}
                department={department}
                onDepartment={setDepartment}
                viewMode={viewMode}
                onViewMode={setViewMode}
                onOpenCounter={showOpenRow}
                onHelp={() => setHelpOpen(true)}
                busy={isValidating && !isInitial}
            />

            {error ? (
                <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
                    <span>Couldn&apos;t load this week: {error.message}</span>
                    <Button size="sm" variant="outline" onClick={() => void mutate()}>
                        Try again
                    </Button>
                </div>
            ) : null}

            {week.shifts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing scheduled this week yet.</p>
            ) : null}

            <div
                aria-busy={isValidating}
                className={cn(
                    "max-h-[calc(100vh-12rem)] min-h-[360px] overflow-auto overscroll-contain rounded-xl border bg-card shadow-sm transition-opacity",
                    isValidating && !data && "opacity-60",
                )}
            >
                {viewMode === "people" ? (
                    <PeopleGrid
                        week={week}
                        view={peopleView}
                        people={people}
                        search={search}
                        onSearch={setSearch}
                        collapsed={collapsed}
                        onToggleSection={toggleSection}
                        flashOpenRow={flashOpen}
                        openRowRef={openRowRef}
                    />
                ) : (
                    <PositionsGrid week={week} rows={positionRows} people={people} />
                )}
            </div>

            <p className="text-xs text-muted-foreground">
                Times are {week.location.name}&apos;s local time ({week.location.timezone.replace(/_/g, " ")}).
            </p>

            <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
        </div>
    );
}
