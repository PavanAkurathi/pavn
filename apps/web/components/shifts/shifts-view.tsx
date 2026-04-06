"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { addDays, addWeeks, format, startOfWeek } from "date-fns";

import { ShiftList } from "./shift-list";
import { CalendarView } from "./calendar-view";
import { EventFilters } from "./event-filters";
import { WeeklyGridView } from "./weekly-grid-view";
import { SHIFT_LAYOUTS, SHIFT_STATUS, LOCATIONS } from "@/lib/constants";
import { useCrewData } from "@/hooks/use-crew-data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { filterActiveShifts, filterNeedsApprovalShifts, filterHistoryShifts } from "@/lib/shifts/view-list";
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
    availableLocations: Location[];
    defaultTab?: ShiftDashboardTab;
    pendingCount: number;
    initialLayoutParam?: string;
}

interface ShiftsDashboardContentProps {
    initialShifts: Shift[];
    availableLocations: Location[];
    defaultTab: ShiftDashboardTab;
    pendingCount: number;
    currentLayout: ShiftLayout;
    availableLayouts: ShiftLayout[];
    onLayoutChange: (layout: ShiftLayout) => void;
}

export function ShiftsView({
    initialShifts,
    availableLocations,
    defaultTab = "upcoming",
    pendingCount,
    initialLayoutParam,
}: ShiftsViewProps) {
    const availableLayouts = getAvailableShiftLayouts(defaultTab);
    const [currentLayout, setCurrentLayout] = useState<ShiftLayout>(
        resolveShiftLayout(defaultTab, initialLayoutParam),
    );

    useEffect(() => {
        setCurrentLayout(resolveShiftLayout(defaultTab, initialLayoutParam));
    }, [defaultTab, initialLayoutParam]);

    const handleLayoutChange = (layout: ShiftLayout) => {
        setCurrentLayout(layout);
    };

    return (
        <ShiftsDashboardContent
            initialShifts={initialShifts}
            availableLocations={availableLocations}
            defaultTab={defaultTab}
            pendingCount={pendingCount}
            currentLayout={currentLayout}
            availableLayouts={availableLayouts}
            onLayoutChange={handleLayoutChange}
        />
    );
}

function ShiftsDashboardContent({
    initialShifts,
    availableLocations,
    defaultTab,
    pendingCount,
    currentLayout,
    availableLayouts,
    onLayoutChange,
}: ShiftsDashboardContentProps) {
    const router = useRouter();
    const pathname = usePathname();
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
    const [selectedWeekStart, setSelectedWeekStart] = useState(() => getInitialWeekStart(initialShifts));

    const handleTabChange = (value: string) => {
        const nextTab: ShiftDashboardTab = value === "past" ? "past" : "upcoming";
        router.push(
            getDashboardShiftsHref({
                view: nextTab,
                layout: resolveShiftLayout(nextTab, currentLayout),
            }),
        );
    };

    const filteredShifts = useMemo(() => {
        return initialShifts.filter((shift) => {
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
        initialShifts,
    ]);

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

    const handleFilterUpdate = (updates: Partial<typeof filters>) => {
        setFilters((prev) => ({ ...prev, ...updates }));
    };

    const weekRangeLabel = `${format(selectedWeekStart, "MMM d")} - ${format(addDays(selectedWeekStart, 6), "MMM d")}`;
    const buildShiftTimesheetHref = (shiftId: string) => {
        const params =
            typeof window !== "undefined"
                ? new URLSearchParams(window.location.search)
                : new URLSearchParams();
        const currentSearch = params.toString();
        const returnTo = currentSearch ? `${pathname}?${currentSearch}` : pathname;

        return getShiftTimesheetHref(shiftId, { returnTo });
    };

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
                onLayoutChange={onLayoutChange}
                weekRangeLabel={weekRangeLabel}
                onPreviousWeek={() => setSelectedWeekStart((current) => addWeeks(current, -1))}
                onTodayWeek={() => setSelectedWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}
                onNextWeek={() => setSelectedWeekStart((current) => addWeeks(current, 1))}
                availableLocations={availableLocations}
                availableWorkers={availableWorkers}
            />

            <div className="mt-6">
                {currentLayout === SHIFT_LAYOUTS.WEEKLY ? (
                    <WeeklyGridView
                        shifts={activeShifts}
                        weekStart={selectedWeekStart}
                        onShiftClick={(shift) => router.push(buildShiftTimesheetHref(shift.id))}
                    />
                ) : currentLayout === SHIFT_LAYOUTS.LIST ? (
                    <Tabs value={defaultTab} onValueChange={handleTabChange} className="space-y-6">
                        <TabsContent value="upcoming" className="space-y-6 mt-0">
                            <div className="space-y-4 max-w-4xl">
                                <h2 className="text-xl font-bold text-foreground" data-testid="upcoming-shifts-widget">
                                    Upcoming Shifts
                                </h2>
                                <ShiftList
                                    shifts={activeShifts}
                                    isLoading={false}
                                    onShiftClick={(shift) => router.push(buildShiftTimesheetHref(shift.id))}
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
                                        onShiftClick={(shift) => router.push(buildShiftTimesheetHref(shift.id))}
                                        isUrgentList={true}
                                    />
                                </div>
                            )}

                            <div className="space-y-4 max-w-4xl">
                                <h2 className="text-xl font-bold text-foreground">Shift History</h2>
                                <ShiftList
                                    shifts={historyShifts}
                                    isLoading={false}
                                    onShiftClick={(shift) => router.push(buildShiftTimesheetHref(shift.id))}
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
                                    onShiftClick={(shift) => router.push(buildShiftTimesheetHref(shift.id))}
                                />
                                {filteredShifts.length === 0 && (
                                    <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                                        No draft shifts found.
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                ) : (
                    <CalendarView
                        shifts={defaultTab === "upcoming" ? activeShifts : filteredShifts}
                        isLoading={false}
                        onShiftClick={(shift) => router.push(buildShiftTimesheetHref(shift.id))}
                    />
                )}
            </div>
        </div>
    );
}
