import { redirect, notFound } from "next/navigation";
import { getShiftById, getShiftTimesheets } from "@/lib/api/shifts";
import { ShiftTimesheetClient } from "./client";

interface PageProps {
    params: Promise<{
        shiftId: string;
    }>;
}

export default async function ShiftTimesheetPage({ params }: PageProps) {
    const { shiftId } = await params;

    if (!shiftId) {
        redirect("/dashboard/shifts");
    }

    const [shift, timesheets] = await Promise.all([
        getShiftById(shiftId),
        getShiftTimesheets(shiftId)
    ]);

    if (!shift) {
        notFound();
    }

    return (
        <ShiftTimesheetClient
            shift={shift}
            timesheets={timesheets}
        />
    );
}
