"use client";

import { useRouter } from "next/navigation";
import { ShiftDetailView } from "@/components/shifts/shift-detail-view";
import { Shift, TimesheetWorker } from "@/lib/types";

interface ShiftTimesheetClientProps {
    shift: Shift;
    timesheets: TimesheetWorker[];
}

export function ShiftTimesheetClient({ shift, timesheets }: ShiftTimesheetClientProps) {
    const router = useRouter();

    return (
        <ShiftDetailView
            shift={shift}
            timesheets={timesheets}
            onBack={() => router.back()}
        />
    );
}
