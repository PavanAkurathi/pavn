"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo, useCallback } from "react";

import { ShiftList } from "./shift-list";
import { EventFilters } from "./event-filters";
import { LOCATIONS } from "@/lib/constants";
import { useCrewData } from "@/hooks/use-crew-data";
import {
    filterHistoryShifts,
    filterInProgressShifts,
    filterNeedsApprovalShifts,
} from "@/lib/shifts/view-list";
import type { Shift, Location } from "@/lib/types";
import { getDashboardShiftsHref, getShiftTimesheetHref } from "@/lib/routes";

interface ShiftsViewProps {
    /** Past shifts and the ones still upcoming; what is on the page is picked out below. */
    shifts: Shift[];
    availableLocations: Location[];
}

/** A small neutral count beside a heading. */
function Count({ count, label }: { count: number; label: string }) {
    if (count <= 0) return null;
    return (
        <span
            aria-label={label}
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-black/10 px-1.5 text-[11px] font-extrabold text-foreground/80"
        >
            {count}
        </span>
    );
}

const byStartAsc = (a: Shift, b: Shift) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
const byStartDesc = (a: Shift, b: Shift) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime();

/**
 * The Timesheets list: what is happening now, what is waiting for approval,
 * and everything that has finished. Nothing here is planned or published.
 */
export function ShiftsView({ shifts, availableLocations }: ShiftsViewProps) {
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

        for (const shift of shifts) {
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
    }, [crew, shifts]);

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

    const filteredShifts = useMemo(() => shifts.filter(matchesFilters), [shifts, matchesFilters]);

    const inProgressShifts = useMemo(() => filterInProgressShifts(filteredShifts).sort(byStartAsc), [filteredShifts]);
    const pendingShifts = useMemo(() => filterNeedsApprovalShifts(filteredShifts).sort(byStartAsc), [filteredShifts]);
    const historyShifts = useMemo(() => filterHistoryShifts(filteredShifts).sort(byStartDesc), [filteredShifts]);

    const handleFilterUpdate = (updates: Partial<typeof filters>) => {
        setFilters((prev) => ({ ...prev, ...updates }));
    };

    const openShiftTimesheet = useCallback(
        (shift: Shift) => {
            router.push(getShiftTimesheetHref(shift.id, { returnTo: getDashboardShiftsHref() }));
        },
        [router],
    );

    return (
        <div className="space-y-6">
            <EventFilters
                filters={filters}
                setFilters={handleFilterUpdate}
                availableLocations={availableLocations}
                availableWorkers={availableWorkers}
            />

            <div className="max-w-4xl space-y-8" data-testid="timesheets-list">
                {inProgressShifts.length > 0 && (
                    <section className="space-y-3">
                        <h2 className="flex items-center gap-2 text-[15px] font-extrabold text-foreground">
                            Happening now
                            <Count count={inProgressShifts.length} label={`${inProgressShifts.length} shifts happening now`} />
                        </h2>
                        <ShiftList shifts={inProgressShifts} isLoading={false} onShiftClick={openShiftTimesheet} actionLabel="Open timesheet" />
                    </section>
                )}

                {pendingShifts.length > 0 && (
                    <section className="space-y-3">
                        <h2 className="flex items-center gap-2 text-[15px] font-extrabold text-foreground">
                            Waiting for approval
                            <Count count={pendingShifts.length} label={`${pendingShifts.length} shifts waiting for approval`} />
                        </h2>
                        <ShiftList
                            shifts={pendingShifts}
                            isLoading={false}
                            onShiftClick={openShiftTimesheet}
                            isUrgentList={true}
                            actionLabel="Review timesheet"
                            order="desc"
                        />
                    </section>
                )}

                <section className="space-y-3">
                    {pendingShifts.length > 0 || inProgressShifts.length > 0 ? (
                        <h2 className="text-[15px] font-extrabold text-foreground">Shift history</h2>
                    ) : (
                        <h2 className="sr-only">Shift history</h2>
                    )}
                    {historyShifts.length > 0 ? <ShiftList shifts={historyShifts} isLoading={false} onShiftClick={openShiftTimesheet} order="desc" /> : null}
                    {historyShifts.length === 0 && pendingShifts.length === 0 && inProgressShifts.length === 0 && (
                        <div className="rounded-2xl border-[1.5px] border-dashed border-border py-12 text-center">
                            <p className="font-semibold text-foreground">No timesheets yet</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Shifts show up here once they start. Plan and publish them in the Schedule.
                            </p>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
