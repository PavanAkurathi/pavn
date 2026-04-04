// apps/web/components/shifts/shifts-view.tsx   

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { addDays, addWeeks, format, startOfWeek } from "date-fns";
import { approveShift, getShiftTimesheets } from "@/lib/api/shifts";
import { TimesheetWorker } from "@/lib/types";
import { toast } from "sonner";

import { ShiftList } from "./shift-list";
import { CalendarView } from "./calendar-view";
import { EventFilters } from "./event-filters";
import { ShiftDetailView } from "./shift-detail-view";
import { WeeklyGridView } from "./weekly-grid-view";
import { SHIFT_LAYOUTS, SHIFT_STATUS, LOCATIONS } from "@/lib/constants";
import { useCrewData } from "@/hooks/use-crew-data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { filterActiveShifts, filterNeedsApprovalShifts, filterHistoryShifts } from "@/lib/shifts/view-list";
import type { Shift, Location } from "@/lib/types";
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
}

export function ShiftsView({ initialShifts, availableLocations, defaultTab = "upcoming", pendingCount }: ShiftsViewProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Derive selection from URL
    const selectedShiftId = searchParams.get("shiftId");
    const layoutParam = searchParams.get("layout");
    const currentLayout = resolveShiftLayout(defaultTab, layoutParam);
    const availableLayouts = getAvailableShiftLayouts(defaultTab);

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

    // -- DETAIL VIEW DATA FETCHING --
    // Find the full shift object from our initial data
    const selectedShift = selectedShiftId ? initialShifts.find(s => s.id === selectedShiftId) : null;
    const [timesheets, setTimesheets] = useState<TimesheetWorker[]>([]);

    useEffect(() => {
        if (selectedShiftId) {
            // In a real app, this might be a server action or separate API call
            getShiftTimesheets(selectedShiftId).then(setTimesheets);
        } else {
            setTimesheets([]);
        }
    }, [selectedShiftId]);

    const handleTabChange = (value: string) => {
        const nextTab: ShiftDashboardTab = value === "past" ? "past" : "upcoming";
        const params = new URLSearchParams(searchParams.toString());
        params.set("view", nextTab);
        params.set("layout", resolveShiftLayout(nextTab, params.get("layout")));
        params.delete("shiftId");
        router.push(`?${params.toString()}`);
    };

    const handleLayoutChange = (layout: typeof currentLayout) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("layout", layout);
        router.push(`?${params.toString()}`);
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
                const hasWorker = shift.assignedWorkers?.some(w => w.id === filters.workerId);
                if (!hasWorker) return false;
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
    }, [initialShifts, filters.location, filters.status, filters.startDate, filters.endDate, filters.workerId, currentLayout]);

    const activeShifts = useMemo(
        () =>
            filterActiveShifts(filteredShifts).sort(
                (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
            ),
        [filteredShifts],
    );

    const handleFilterUpdate = (updates: Partial<typeof filters>) => {
        setFilters((prev) => ({ ...prev, ...updates }));
    };

    const updateShiftId = (id: string | null) => {
        const params = new URLSearchParams(searchParams.toString());
        if (id) {
            params.set("shiftId", id);
        } else {
            params.delete("shiftId");
        }
        router.push(`?${params.toString()}`);
    };

    const handleApproveShift = async (shiftId: string) => {
        try {
            await approveShift(shiftId);
            toast.success("Shift approved successfully");
            updateShiftId(null); // Waiting for file view
            router.refresh(); // This will re-fetch data and move the shift to history
        } catch (error) {
            toast.error("Failed to approve shift");
        }
    };

    if (selectedShiftId && selectedShift) {
        return (
            <ShiftDetailView
                shift={selectedShift}
                timesheets={timesheets}
                onBack={() => updateShiftId(null)}
                onApprove={() => handleApproveShift(selectedShift.id)}
            />
        );
    }

    const pendingShifts = filterNeedsApprovalShifts(filteredShifts)
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    const historyShifts = filterHistoryShifts(filteredShifts)
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    const weekRangeLabel = `${format(selectedWeekStart, "MMM d")} - ${format(addDays(selectedWeekStart, 6), "MMM d")}`;

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
                        <TabsTrigger value="draft" className="hidden">Drafts</TabsTrigger>
                    </TabsList>
                </Tabs>

                {/* Shared Controls */}
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
                onNextWeek={() => setSelectedWeekStart((current) => addWeeks(current, 1))}
                availableLocations={availableLocations}
                availableWorkers={availableWorkers}
            />

            <div className="mt-6">
                {currentLayout === SHIFT_LAYOUTS.WEEKLY ? (
                    <WeeklyGridView
                        shifts={activeShifts}
                        weekStart={selectedWeekStart}
                        onShiftClick={(shift) => updateShiftId(shift.id)}
                    />
                ) : currentLayout === SHIFT_LAYOUTS.LIST ? (
                    <Tabs value={defaultTab} onValueChange={handleTabChange} className="space-y-6">
                        <TabsContent value="upcoming" className="space-y-6 mt-0">
                            <div className="space-y-4 max-w-4xl">
                                <h2 className="text-xl font-bold text-foreground" data-testid="upcoming-shifts-widget">Upcoming Shifts</h2>
                                <ShiftList
                                    shifts={activeShifts}
                                    isLoading={false}
                                    onShiftClick={(s) => updateShiftId(s.id)}
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="past" className="space-y-8 mt-0">
                            {/* Section A: Action Required */}
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
                                        onShiftClick={(s) => updateShiftId(s.id)}
                                        isUrgentList={true}
                                    />
                                </div>
                            )}

                            {/* Section B: History */}
                            <div className="space-y-4 max-w-4xl">
                                <h2 className="text-xl font-bold text-foreground">Shift History</h2>
                                <ShiftList
                                    shifts={historyShifts}
                                    isLoading={false}
                                    onShiftClick={(s) => updateShiftId(s.id)}
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
                                    onShiftClick={(s) => updateShiftId(s.id)}
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
                        onShiftClick={(shift) => updateShiftId(shift.id)}
                    />
                )}
            </div>
        </div>
    );
}
