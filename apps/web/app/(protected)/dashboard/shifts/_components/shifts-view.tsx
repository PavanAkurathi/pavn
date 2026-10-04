"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo, useCallback } from "react";

import { ShiftList } from "./shift-list";
import { DraftGroups } from "./draft-groups";
import { EventFilters } from "./event-filters";
import { LOCATIONS } from "@/lib/constants";
import { useCrewData } from "@/hooks/use-crew-data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import {
    filterActiveShifts,
    filterDraftShifts,
    filterNeedsApprovalShifts,
    filterHistoryShifts,
} from "@/lib/shifts/view-list";
import { groupDraftsByWeek } from "@/lib/shifts/draft-groups";
import type { Shift, Location } from "@/lib/types";
import { getDashboardShiftsHref, getShiftTimesheetHref, type ShiftDashboardTab } from "@/lib/routes";

interface ShiftsViewProps {
    /** The published shifts of the open tab (Upcoming or Past). */
    initialShifts: Shift[];
    /** Unpublished shifts. They are kept in the Drafts tab, a week at a time, and built in the Scheduler. */
    draftShifts?: Shift[];
    availableLocations: Location[];
    defaultTab?: ShiftDashboardTab;
    pendingCount: number;
    /** First day of the week, 0 = Sunday: the week a draft is published with. */
    weekStartsOn?: number;
}

/** A small neutral count beside a tab name. */
function TabCount({ count, label }: { count: number; label: string }) {
    if (count <= 0) return null;
    return (
        <span
            aria-label={label}
            className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-black/10 px-1.5 text-[11px] font-extrabold text-foreground/80"
        >
            {count}
        </span>
    );
}

const TAB_TRIGGER = "rounded-[9px] px-5 py-2 text-[13.5px] font-semibold";

export function ShiftsView({
    initialShifts,
    draftShifts = [],
    availableLocations,
    defaultTab = "upcoming",
    pendingCount,
    weekStartsOn = 0,
}: ShiftsViewProps) {
    const router = useRouter();
    const { crew } = useCrewData();
    const availableWorkers = useMemo(() => {
        const workerMap = new Map<string, { id: string; name: string; initials: string }>();

        for (const worker of crew) {
            workerMap.set(worker.id, {
                id: worker.id,
                name: worker.name,
                initials: worker.initials,
            });
        }

        for (const shift of initialShifts) {
            for (const worker of shift.assignedWorkers ?? []) {
                if (!workerMap.has(worker.id)) {
                    workerMap.set(worker.id, {
                        id: worker.id,
                        name: worker.name || worker.initials,
                        initials: worker.initials,
                    });
                }
            }
        }

        return Array.from(workerMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [crew, initialShifts]);

    const [filters, setFilters] = useState<{
        location: string | null;
        startDate: string | null;
        endDate: string | null;
        workerId: string | null;
    }>({
        location: LOCATIONS.ALL,
        startDate: null,
        endDate: null,
        workerId: null,
    });

    const handleTabChange = (value: string) => {
        const nextTab: ShiftDashboardTab = value === "past" ? "past" : value === "drafts" ? "drafts" : "upcoming";
        router.push(getDashboardShiftsHref({ view: nextTab }));
    };

    const matchesFilters = useCallback(
        (shift: Shift) => {
            if (filters.location !== LOCATIONS.ALL && shift.locationName !== filters.location) {
                return false;
            }

            if (filters.workerId) {
                const hasWorker = shift.assignedWorkers?.some((worker) => worker.id === filters.workerId);
                if (!hasWorker) {
                    return false;
                }
            }

            if (filters.startDate && filters.endDate) {
                const shiftStart = new Date(shift.startTime).getTime();
                const start = new Date(filters.startDate).getTime();
                const end = new Date(filters.endDate).getTime() + 86400000;

                if (shiftStart < start || shiftStart >= end) {
                    return false;
                }
            }

            return true;
        },
        [filters.endDate, filters.location, filters.startDate, filters.workerId],
    );

    const filteredShifts = useMemo(
        () => initialShifts.filter(matchesFilters),
        [initialShifts, matchesFilters],
    );

    // Upcoming is what has been published. Drafts have their own tab and never mix in.
    const activeShifts = useMemo(
        () =>
            filterActiveShifts(filteredShifts).sort(
                (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
            ),
        [filteredShifts],
    );

    const pendingShifts = useMemo(
        () =>
            filterNeedsApprovalShifts(filteredShifts).sort(
                (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
            ),
        [filteredShifts],
    );

    const historyShifts = useMemo(
        () =>
            filterHistoryShifts(filteredShifts).sort(
                (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
            ),
        [filteredShifts],
    );

    const upcomingDrafts = useMemo(() => filterDraftShifts(draftShifts), [draftShifts]);
    // The tab counts drafts the way the tab lists them (a week at a time), and
    // counts them all: a filter narrows the list, not the number of drafts you have.
    const draftGroupCount = useMemo(
        () => groupDraftsByWeek(upcomingDrafts, weekStartsOn).length,
        [upcomingDrafts, weekStartsOn],
    );
    const draftGroups = useMemo(
        () => groupDraftsByWeek(upcomingDrafts.filter(matchesFilters), weekStartsOn),
        [upcomingDrafts, matchesFilters, weekStartsOn],
    );

    const handleFilterUpdate = (updates: Partial<typeof filters>) => {
        setFilters((prev) => ({ ...prev, ...updates }));
    };

    const buildShiftTimesheetHref = useCallback((shiftId: string) => {
        return getShiftTimesheetHref(shiftId, { returnTo: getDashboardShiftsHref({ view: defaultTab }) });
    }, [defaultTab]);

    const openShiftTimesheet = useCallback((shift: Shift) => {
        router.push(buildShiftTimesheetHref(shift.id));
    }, [buildShiftTimesheetHref, router]);

    return (
        <div className="space-y-5">
            <Tabs value={defaultTab} onValueChange={handleTabChange} className="space-y-5">
                <TabsList className="h-auto rounded-xl bg-muted p-1">
                    <TabsTrigger value="upcoming" className={TAB_TRIGGER}>
                        Upcoming
                    </TabsTrigger>
                    <TabsTrigger value="drafts" className={TAB_TRIGGER}>
                        Drafts
                        <TabCount count={draftGroupCount} label={`${draftGroupCount} drafts`} />
                    </TabsTrigger>
                    <TabsTrigger value="past" className={TAB_TRIGGER}>
                        Past
                        <TabCount count={pendingCount} label={`${pendingCount} waiting for approval`} />
                    </TabsTrigger>
                </TabsList>

                <EventFilters
                    filters={filters}
                    setFilters={handleFilterUpdate}
                    availableLocations={availableLocations}
                    availableWorkers={availableWorkers}
                />

                <TabsContent value="upcoming" className="mt-0 max-w-4xl">
                    <h2 className="sr-only" data-testid="upcoming-shifts-widget">
                        Upcoming shifts
                    </h2>
                    <ShiftList
                        shifts={activeShifts}
                        isLoading={false}
                        onShiftClick={openShiftTimesheet}
                    />
                </TabsContent>

                <TabsContent value="drafts" className="mt-0 max-w-4xl">
                    <h2 className="sr-only">Draft shifts</h2>
                    <DraftGroups groups={draftGroups} />
                </TabsContent>

                <TabsContent value="past" className="mt-0 max-w-4xl space-y-8">
                    {pendingShifts.length > 0 && (
                        <div className="space-y-3">
                            <h2 className="flex items-center gap-2 text-[15px] font-extrabold text-foreground">
                                Waiting for approval
                                <TabCount count={pendingShifts.length} label={`${pendingShifts.length} shifts`} />
                            </h2>
                            <ShiftList
                                shifts={pendingShifts}
                                isLoading={false}
                                onShiftClick={openShiftTimesheet}
                                isUrgentList={true}
                                actionLabel="Review timesheet"
                                order="desc"
                            />
                        </div>
                    )}

                    <div className="space-y-3">
                        {pendingShifts.length > 0 ? (
                            <h2 className="text-[15px] font-extrabold text-foreground">Shift history</h2>
                        ) : (
                            <h2 className="sr-only">Shift history</h2>
                        )}
                        <ShiftList
                            shifts={historyShifts}
                            isLoading={false}
                            onShiftClick={openShiftTimesheet}
                            order="desc"
                        />
                        {historyShifts.length === 0 && !pendingShifts.length && (
                            <div className="rounded-2xl border-[1.5px] border-dashed border-border py-12 text-center text-muted-foreground">
                                No past shifts found matching your filters.
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
