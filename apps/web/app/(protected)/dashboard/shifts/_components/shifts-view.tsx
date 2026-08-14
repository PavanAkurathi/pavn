"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo, useCallback } from "react";
import { addDays, addWeeks, format, startOfWeek } from "date-fns";

import { ShiftList } from "./shift-list";
import { EventFilters } from "./event-filters";
import { WeeklyGridView } from "./weekly-grid-view";
import { ScheduleSummary } from "./schedule-summary";
import { copyLastWeekAction } from "../_actions/copy-week";
import { publishDraftsAction } from "../_actions/publish-drafts";
import { DraftPublishBar } from "./draft-publish-bar";
import { toast } from "sonner";
import { SHIFT_LAYOUTS, SHIFT_STATUS, LOCATIONS } from "@/lib/constants";
import { useCrewData } from "@/hooks/use-crew-data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import {
    filterActiveShifts,
    filterDraftShifts,
    filterNeedsApprovalShifts,
    filterHistoryShifts,
} from "@/lib/shifts/view-list";
import type { Shift, Location, ShiftLayout } from "@/lib/types";
import { getDashboardShiftsHref, getShiftTimesheetHref } from "@/lib/routes";
import {
    getAvailableShiftLayouts,
    getInitialWeekStart,
    resolveShiftLayout,
    type ShiftDashboardTab,
} from "@/lib/shifts/weekly-grid";

interface ShiftsViewProps {
    initialShifts: Shift[];
    /** Unpublished shifts, kept separate so they can be shown and announced as a set. */
    draftShifts?: Shift[];
    availableLocations: Location[];
    defaultTab?: ShiftDashboardTab;
    pendingCount: number;
    initialLayoutParam?: string;
    initialWeekParam?: string;
}

interface ShiftsDashboardContentProps {
    initialShifts: Shift[];
    draftShifts: Shift[];
    availableLocations: Location[];
    defaultTab: ShiftDashboardTab;
    pendingCount: number;
    currentLayout: ShiftLayout;
    availableLayouts: ShiftLayout[];
    onLayoutChange: (layout: ShiftLayout) => void;
    initialWeekParam?: string;
}

export function ShiftsView({
    initialShifts,
    draftShifts = [],
    availableLocations,
    defaultTab = "upcoming",
    pendingCount,
    initialLayoutParam,
    initialWeekParam,
}: ShiftsViewProps) {
    const availableLayouts = getAvailableShiftLayouts(defaultTab);
    const resolvedInitialLayout = useMemo(
        () => resolveShiftLayout(defaultTab, initialLayoutParam),
        [defaultTab, initialLayoutParam],
    );
    const [currentLayout, setCurrentLayout] = useState<ShiftLayout>(
        resolvedInitialLayout,
    );

    useEffect(() => {
        setCurrentLayout(resolvedInitialLayout);
    }, [resolvedInitialLayout]);

    const handleLayoutChange = (layout: ShiftLayout) => {
        setCurrentLayout(layout);
    };

    return (
        <ShiftsDashboardContent
            initialShifts={initialShifts}
            draftShifts={draftShifts}
            availableLocations={availableLocations}
            defaultTab={defaultTab}
            pendingCount={pendingCount}
            currentLayout={currentLayout}
            availableLayouts={availableLayouts}
            onLayoutChange={handleLayoutChange}
            initialWeekParam={initialWeekParam}
        />
    );
}

function ShiftsDashboardContent({
    initialShifts,
    draftShifts,
    availableLocations,
    defaultTab,
    pendingCount,
    currentLayout,
    availableLayouts,
    onLayoutChange,
    initialWeekParam,
}: ShiftsDashboardContentProps) {
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
        status: string | null;
        startDate: string | null;
        endDate: string | null;
        workerId: string | null;
    }>({
        location: LOCATIONS.ALL,
        status: SHIFT_STATUS.ALL,
        startDate: null,
        endDate: null,
        workerId: null,
    });
    const [selectedWeekStart, setSelectedWeekStart] = useState(() =>
        getInitialWeekStart(initialShifts, new Date(), initialWeekParam),
    );
    const syncDashboardUrl = useCallback(
        (tab: ShiftDashboardTab, layout: ShiftLayout) => {
            if (typeof window === "undefined") {
                return;
            }

            const href = getDashboardShiftsHref({
                view: tab,
                layout,
            });

            window.history.replaceState(null, "", href);
        },
        [],
    );

    const handleTabChange = (value: string) => {
        const nextTab: ShiftDashboardTab = value === "past" ? "past" : "upcoming";
        router.push(
            getDashboardShiftsHref({
                view: nextTab,
                layout: resolveShiftLayout(nextTab, currentLayout),
            }),
        );
    };

    // Drafts sit in the same pool as everything else so the filters, the week
    // navigation and the grid all treat them as part of the schedule. They only
    // diverge where it matters: they are marked as drafts, and they can be
    // published.
    const schedulePool = useMemo(
        () => (draftShifts.length > 0 ? [...initialShifts, ...draftShifts] : initialShifts),
        [draftShifts, initialShifts],
    );

    const filteredShifts = useMemo(() => {
        return schedulePool.filter((shift) => {
            if (filters.location !== LOCATIONS.ALL && shift.locationName !== filters.location) {
                return false;
            }

            if (filters.status !== SHIFT_STATUS.ALL && shift.status !== filters.status) {
                return false;
            }

            if (filters.workerId) {
                const hasWorker = shift.assignedWorkers?.some((worker) => worker.id === filters.workerId);
                if (!hasWorker) {
                    return false;
                }
            }

            if (currentLayout !== SHIFT_LAYOUTS.WEEKLY && filters.startDate && filters.endDate) {
                const shiftStart = new Date(shift.startTime).getTime();
                const start = new Date(filters.startDate).getTime();
                const end = new Date(filters.endDate).getTime() + 86400000;

                if (shiftStart < start || shiftStart >= end) {
                    return false;
                }
            }

            return true;
        });
    }, [
        currentLayout,
        filters.endDate,
        filters.location,
        filters.startDate,
        filters.status,
        filters.workerId,
        schedulePool,
    ]);

    const activeShifts = useMemo(
        () =>
            [...filterActiveShifts(filteredShifts), ...filterDraftShifts(filteredShifts)].sort(
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

    const handleFilterUpdate = (updates: Partial<typeof filters>) => {
        setFilters((prev) => ({ ...prev, ...updates }));
    };

    const weekRangeLabel = `${format(selectedWeekStart, "MMM d")} - ${format(addDays(selectedWeekStart, 6), "MMM d")}`;

    // Copying needs one location to copy: with "All locations" selected there is
    // no single week to duplicate, so the button only appears once a location
    // is chosen (or the org only has one).
    const copyTargetLocation = useMemo(() => {
        if (filters.location && filters.location !== LOCATIONS.ALL) {
            return availableLocations.find((loc) => loc.name === filters.location) ?? null;
        }
        return availableLocations.length === 1 ? availableLocations[0]! : null;
    }, [availableLocations, filters.location]);

    const [isCopyingWeek, setIsCopyingWeek] = useState(false);

    const handleCopyLastWeek = useCallback(async () => {
        if (!copyTargetLocation) return;
        setIsCopyingWeek(true);
        try {
            const result = await copyLastWeekAction(
                copyTargetLocation.id,
                format(selectedWeekStart, "yyyy-MM-dd"),
            );

            if ("error" in result) {
                toast.error(result.error);
                return;
            }

            if (result.copied === 0) {
                toast.info(result.message ?? "Nothing to copy into this week.");
                return;
            }

            const skipped = result.skippedDays.length
                ? `, skipped ${result.skippedDays.length} day${result.skippedDays.length === 1 ? "" : "s"} that already had shifts`
                : "";
            toast.success(
                `Copied ${result.copied} shift${result.copied === 1 ? "" : "s"} as drafts${skipped}. Review and publish when ready.`,
            );
            // Pull the new drafts down so they appear in the week that was just
            // filled, rather than leaving the manager staring at an empty grid.
            router.refresh();
        } finally {
            setIsCopyingWeek(false);
        }
    }, [copyTargetLocation, router, selectedWeekStart]);

    // What the manager is actually looking at. The weekly grid shows one week;
    // the list shows whatever the filters left standing. The summary and the
    // publish action both work off this, so neither can claim more than the
    // screen shows.
    const shiftsInView = useMemo(() => {
        if (currentLayout !== SHIFT_LAYOUTS.WEEKLY) {
            return activeShifts;
        }

        const weekStart = selectedWeekStart.getTime();
        const weekEnd = addDays(selectedWeekStart, 7).getTime();
        return activeShifts.filter((shift) => {
            // Same overlap test the grid uses, so an overnight shift starting
            // Saturday still counts for the week it began in.
            return new Date(shift.endTime).getTime() > weekStart
                && new Date(shift.startTime).getTime() < weekEnd;
        });
    }, [activeShifts, currentLayout, selectedWeekStart]);

    const visibleDrafts = useMemo(() => filterDraftShifts(shiftsInView), [shiftsInView]);

    const [isPublishingDrafts, setIsPublishingDrafts] = useState(false);

    const handlePublishDrafts = useCallback(async () => {
        if (visibleDrafts.length === 0) return;
        // Counted before the refresh wipes the drafts out from under us.
        const assignedBefore = visibleDrafts.reduce(
            (sum, shift) => sum + (shift.capacity?.filled ?? shift.assignedWorkers?.length ?? 0),
            0,
        );
        setIsPublishingDrafts(true);
        try {
            const result = await publishDraftsAction(visibleDrafts.map((shift) => shift.id));

            if ("error" in result) {
                toast.error(result.error);
                return;
            }

            const notified = result.notified > 0
                ? ` ${result.notified} worker${result.notified === 1 ? "" : "s"} notified.`
                : assignedBefore > 0
                    ? " The assigned workers are invited or agency — tell them yourself."
                    : " Nobody is assigned yet, so these are open for anyone to claim.";
            toast.success(
                `Published ${result.published} shift${result.published === 1 ? "" : "s"}.${notified}`,
            );
            router.refresh();
        } finally {
            setIsPublishingDrafts(false);
        }
    }, [router, visibleDrafts]);

    const buildShiftTimesheetHref = useCallback((shiftId: string) => {
        const returnTo = getDashboardShiftsHref({
            view: defaultTab,
            layout: currentLayout,
        });

        return getShiftTimesheetHref(shiftId, { returnTo });
    }, [currentLayout, defaultTab]);

    const openShiftTimesheet = useCallback((shift: Shift) => {
        router.push(buildShiftTimesheetHref(shift.id));
    }, [buildShiftTimesheetHref, router]);

    const handleLayoutChange = useCallback((layout: ShiftLayout) => {
        onLayoutChange(layout);
        syncDashboardUrl(defaultTab, layout);
    }, [defaultTab, onLayoutChange, syncDashboardUrl]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <Tabs value={defaultTab} className="w-full sm:w-auto" onValueChange={handleTabChange}>
                    <TabsList className="grid w-full grid-cols-2 sm:w-[320px]">
                        <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                        <TabsTrigger value="past" className="relative">
                            Past
                            {pendingCount > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                                    {pendingCount}
                                </span>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="draft" className="hidden">
                            Drafts
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <EventFilters
                filters={filters}
                setFilters={handleFilterUpdate}
                layout={currentLayout}
                availableLayouts={availableLayouts}
                onLayoutChange={handleLayoutChange}
                weekRangeLabel={weekRangeLabel}
                onPreviousWeek={() => setSelectedWeekStart((current) => addWeeks(current, -1))}
                onTodayWeek={() => setSelectedWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}
                onCopyLastWeek={copyTargetLocation ? handleCopyLastWeek : undefined}
                isCopyingWeek={isCopyingWeek}
                onNextWeek={() => setSelectedWeekStart((current) => addWeeks(current, 1))}
                availableLocations={availableLocations}
                availableWorkers={availableWorkers}
            />

            <div className="mt-6 space-y-4">
                <ScheduleSummary
                    shifts={shiftsInView}
                    countMode={currentLayout === SHIFT_LAYOUTS.WEEKLY ? "positions" : "blocks"}
                />

                {defaultTab === "upcoming" ? (
                    <div className="max-w-4xl">
                        <DraftPublishBar
                            drafts={visibleDrafts}
                            scopeLabel={
                                currentLayout === SHIFT_LAYOUTS.WEEKLY
                                    ? `in ${weekRangeLabel}`
                                    : "on your schedule"
                            }
                            isPublishing={isPublishingDrafts}
                            onPublish={handlePublishDrafts}
                        />
                    </div>
                ) : null}

                {currentLayout === SHIFT_LAYOUTS.WEEKLY ? (
                    <WeeklyGridView
                        shifts={activeShifts}
                        weekStart={selectedWeekStart}
                        onShiftClick={openShiftTimesheet}
                    />
                ) : (
                    <Tabs value={defaultTab} onValueChange={handleTabChange} className="space-y-6">
                        <TabsContent value="upcoming" className="space-y-6 mt-0">
                            <div className="space-y-4 max-w-4xl">
                                <h2 className="text-xl font-bold text-foreground" data-testid="upcoming-shifts-widget">
                                    Upcoming Shifts
                                </h2>
                                <ShiftList
                                    shifts={activeShifts}
                                    isLoading={false}
                                    onShiftClick={openShiftTimesheet}
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="past" className="space-y-8 mt-0">
                            {pendingShifts.length > 0 && (
                                <div className="space-y-4 max-w-4xl">
                                    <h2 className="text-xl font-bold flex items-center gap-2 text-red-600 whitespace-nowrap">
                                        Action Required
                                        <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-red-100 px-2 text-xs font-semibold text-red-700">
                                            {pendingShifts.length}
                                        </span>
                                    </h2>
                                    <ShiftList
                                        shifts={pendingShifts}
                                        isLoading={false}
                                        onShiftClick={openShiftTimesheet}
                                        isUrgentList={true}
                                    />
                                </div>
                            )}

                            <div className="space-y-4 max-w-4xl">
                                <h2 className="text-xl font-bold text-foreground">Shift History</h2>
                                <ShiftList
                                    shifts={historyShifts}
                                    isLoading={false}
                                    onShiftClick={openShiftTimesheet}
                                />
                                {historyShifts.length === 0 && !pendingShifts.length && (
                                    <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                                        No past shifts found matching your filters.
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="draft" className="space-y-6 mt-0">
                            <div className="space-y-4 max-w-4xl">
                                <h2 className="text-xl font-bold text-yellow-700">Draft Shifts</h2>
                                <ShiftList
                                    shifts={filteredShifts}
                                    isLoading={false}
                                    onShiftClick={openShiftTimesheet}
                                />
                                {filteredShifts.length === 0 && (
                                    <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                                        No draft shifts found.
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                )}
            </div>
        </div>
    );
}
