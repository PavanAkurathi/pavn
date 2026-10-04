"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo, useCallback } from "react";

import { ShiftList } from "./shift-list";
import { EventFilters } from "./event-filters";
import { ScheduleSummary } from "./schedule-summary";
import { SHIFT_STATUS, LOCATIONS } from "@/lib/constants";
import { useCrewData } from "@/hooks/use-crew-data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import {
    filterActiveShifts,
    filterDraftShifts,
    filterNeedsApprovalShifts,
    filterHistoryShifts,
} from "@/lib/shifts/view-list";
import type { Shift, Location } from "@/lib/types";
import { getDashboardShiftsHref, getShiftTimesheetHref, type ShiftDashboardTab } from "@/lib/routes";

interface ShiftsViewProps {
    initialShifts: Shift[];
    /** Unpublished shifts: listed with the rest, marked as drafts. They are built and published in the Scheduler. */
    draftShifts?: Shift[];
    availableLocations: Location[];
    defaultTab?: ShiftDashboardTab;
    pendingCount: number;
}

export function ShiftsView({
    initialShifts,
    draftShifts = [],
    availableLocations,
    defaultTab = "upcoming",
    pendingCount,
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

    const handleTabChange = (value: string) => {
        const nextTab: ShiftDashboardTab = value === "past" ? "past" : "upcoming";
        router.push(getDashboardShiftsHref({ view: nextTab }));
    };

    // Drafts sit in the same pool as everything else so the filters treat them
    // as part of the schedule; they are marked as drafts on their cards.
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

            if (filters.startDate && filters.endDate) {
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

    const buildShiftTimesheetHref = useCallback((shiftId: string) => {
        return getShiftTimesheetHref(shiftId, { returnTo: getDashboardShiftsHref({ view: defaultTab }) });
    }, [defaultTab]);

    const openShiftTimesheet = useCallback((shift: Shift) => {
        router.push(buildShiftTimesheetHref(shift.id));
    }, [buildShiftTimesheetHref, router]);

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
                availableLocations={availableLocations}
                availableWorkers={availableWorkers}
            />

            <div className="mt-6 space-y-4">
                <ScheduleSummary shifts={activeShifts} countMode="blocks" />

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
                                    order="desc"
                                />
                            </div>
                        )}

                        <div className="space-y-4 max-w-4xl">
                            <h2 className="text-xl font-bold text-foreground">Shift History</h2>
                            <ShiftList
                                shifts={historyShifts}
                                isLoading={false}
                                onShiftClick={openShiftTimesheet}
                                order="desc"
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
            </div>
        </div>
    );
}
