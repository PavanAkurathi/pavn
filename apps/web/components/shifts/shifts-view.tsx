"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { shiftService } from "@repo/shifts";
import { TimesheetWorker } from "@/lib/types";
import { toast } from "sonner";

import { ShiftList } from "./shift-list";
import { CalendarView } from "./calendar-view";
import { EventFilters } from "./event-filters";
import { ShiftDetailView } from "./shift-detail-view";
import { SHIFT_STATUS, LOCATIONS, VIEW_MODES } from "@/lib/constants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { filterActiveShifts, filterNeedsApprovalShifts, filterHistoryShifts } from "@/lib/shifts/view-list";
import type { Shift } from "@/lib/types";

interface ShiftsViewProps {
    initialShifts: Shift[];
    availableLocations: string[];
    defaultTab?: string;
}

export function ShiftsView({ initialShifts, availableLocations, defaultTab = "upcoming" }: ShiftsViewProps) {
    const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
    const [filters, setFilters] = useState({
        location: LOCATIONS.ALL,
        status: SHIFT_STATUS.ALL,
        view: VIEW_MODES.LIST,
        startDate: null as string | null,
        endDate: null as string | null,
    });

    const router = useRouter();
    const searchParams = useSearchParams();

    // -- DETAIL VIEW DATA FETCHING --
    // Find the full shift object from our initial data
    const selectedShift = selectedShiftId ? initialShifts.find(s => s.id === selectedShiftId) : null;
    const [timesheets, setTimesheets] = useState<TimesheetWorker[]>([]);

    useEffect(() => {
        if (selectedShiftId) {
            // In a real app, this might be a server action or separate API call
            shiftService.getTimesheetsForShift(selectedShiftId).then(setTimesheets);
        } else {
            setTimesheets([]);
        }
    }, [selectedShiftId]);

    const handleTabChange = (value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("view", value);
        router.push(`?${params.toString()}`);
    };

    // Basic client-side filtering (ideally this happens on server or via API)
    const filteredShifts = initialShifts.filter((shift) => {
        // 1. Location
        if (filters.location !== LOCATIONS.ALL && shift.locationName !== filters.location) {
            return false;
        }

        // 3. Date Range
        if (filters.startDate && filters.endDate) {
            const shiftStart = new Date(shift.startTime).getTime();
            const start = new Date(filters.startDate).getTime();
            // Add one day to end date to make it inclusive for the UI selection
            const end = new Date(filters.endDate).getTime() + 86400000;

            if (shiftStart < start || shiftStart >= end) {
                return false;
            }
        }

        return true;
    });

    const handleFilterUpdate = (updates: Partial<typeof filters>) => {
        setFilters((prev) => ({ ...prev, ...updates }));
    };

    const handleApproveShift = async (shiftId: string) => {
        try {
            await shiftService.approveShift(shiftId);
            toast.success("Shift approved successfully");
            setSelectedShiftId(null); // Return to list view
            router.refresh();
        } catch (error) {
            toast.error("Failed to approve shift");
        }
    };

    if (selectedShiftId && selectedShift) {
        return (
            <ShiftDetailView
                shift={selectedShift}
                timesheets={timesheets}
                onBack={() => setSelectedShiftId(null)}
                onApprove={() => handleApproveShift(selectedShift.id)}
            />
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <Tabs value={defaultTab} className="w-full sm:w-auto" onValueChange={handleTabChange}>
                    <TabsList className="grid w-full grid-cols-3 sm:w-[320px]">
                        <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                        <TabsTrigger value="needs_approval">Needs Approval</TabsTrigger>
                        <TabsTrigger value="past">Past</TabsTrigger>
                    </TabsList>
                </Tabs>

                {/* Shared Controls */}
            </div>

            <EventFilters
                filters={filters}
                setFilters={handleFilterUpdate}
                availableLocations={availableLocations}
            />

            <div className="mt-6">
                {filters.view === VIEW_MODES.LIST ? (
                    <Tabs value={defaultTab} onValueChange={handleTabChange} className="space-y-6">
                        <TabsContent value="upcoming" className="space-y-6 mt-0">
                            <div className="space-y-4 max-w-4xl">
                                <h2 className="text-xl font-bold text-foreground">Upcoming Shifts</h2>
                                <ShiftList
                                    shifts={filterActiveShifts(filteredShifts)}
                                    isLoading={false}
                                    onShiftClick={(s) => setSelectedShiftId(s.id)}
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="needs_approval" className="space-y-6 mt-0">
                            <div className="space-y-4 max-w-4xl">
                                <h2 className="text-xl font-bold flex items-center gap-2 text-amber-600">
                                    Needs Approval
                                </h2>
                                <ShiftList
                                    shifts={filterNeedsApprovalShifts(filteredShifts)}
                                    isLoading={false}
                                    onShiftClick={(s) => setSelectedShiftId(s.id)}
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="past" className="space-y-6 mt-0">
                            {/* History Section */}
                            <div className="space-y-4 max-w-4xl">
                                <h2 className="text-xl font-bold text-foreground">Completed Shifts</h2>
                                <ShiftList
                                    shifts={filterHistoryShifts(filteredShifts)}
                                    isLoading={false}
                                    onShiftClick={(s) => setSelectedShiftId(s.id)}
                                />
                            </div>
                        </TabsContent>
                    </Tabs>
                ) : (
                    <CalendarView
                        shifts={filteredShifts}
                        isLoading={false}
                    />
                )}
            </div>
        </div>
    );
}
