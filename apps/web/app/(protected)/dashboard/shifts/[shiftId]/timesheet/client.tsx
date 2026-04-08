"use client";

import { ShiftDetailView } from "../../_components/shift-detail-view";
import { DASHBOARD_SHIFTS_PATH, isSafeDashboardReturnPath } from "@/lib/routes";
import { Shift, TimesheetWorker } from "@/lib/types";

interface ShiftTimesheetClientProps {
    shift: Shift;
    timesheets: TimesheetWorker[];
    returnTo?: string;
}

export function ShiftTimesheetClient({ shift, timesheets, returnTo }: ShiftTimesheetClientProps) {
    const safeReturnTo = isSafeDashboardReturnPath(returnTo)
        ? returnTo
        : DASHBOARD_SHIFTS_PATH;

    return (
        <ShiftDetailView
            shift={shift}
            timesheets={timesheets}
            onBack={() => window.location.assign(safeReturnTo)}
        />
    );
}
