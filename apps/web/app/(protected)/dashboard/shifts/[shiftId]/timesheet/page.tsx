import { redirect, notFound } from "next/navigation";
import { getShiftById, getShiftTimesheets } from "@/lib/api/shifts";
import { ShiftTimesheetClient } from "./client";
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

    const [shift, timesheets] = await Promise.all([
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
