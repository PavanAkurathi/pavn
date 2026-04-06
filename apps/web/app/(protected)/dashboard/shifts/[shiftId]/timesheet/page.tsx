import { redirect, notFound } from "next/navigation";
import { getShiftById, getShiftTimesheets } from "@/lib/api/shifts";
import { ShiftTimesheetClient } from "./client";
import {
    getDashboardMockShiftById,
    getDashboardMockTimesheets,
    isDashboardMockShiftId,
} from "@/lib/shifts/data";
import { DASHBOARD_SHIFTS_PATH } from "@/lib/routes";

interface PageProps {
    params: Promise<{
        shiftId: string;
    }>;
    searchParams: Promise<{
        returnTo?: string;
    }>;
}

export default async function ShiftTimesheetPage({ params, searchParams }: PageProps) {
    const { shiftId } = await params;
    const { returnTo } = await searchParams;

    if (!shiftId) {
        redirect(DASHBOARD_SHIFTS_PATH);
    }

    const [shift, timesheets] = isDashboardMockShiftId(shiftId)
        ? await Promise.all([
            Promise.resolve(getDashboardMockShiftById(shiftId)),
            Promise.resolve(getDashboardMockTimesheets(shiftId)),
        ])
        : await Promise.all([
            getShiftById(shiftId),
            getShiftTimesheets(shiftId),
        ]);

    if (!shift) {
        notFound();
    }

    return (
        <ShiftTimesheetClient
            shift={shift}
            timesheets={timesheets}
            returnTo={returnTo}
        />
    );
}
