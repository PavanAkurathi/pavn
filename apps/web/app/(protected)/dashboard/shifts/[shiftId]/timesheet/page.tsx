import { redirect, notFound } from "next/navigation";
import { getShiftById, getShiftTimesheets } from "@/lib/api/shifts";
import { ShiftTimesheetClient } from "./client";

interface PageProps {
    params: {
        shiftId: string;
    };
}

export default async function ShiftTimesheetPage({ params }: PageProps) {
    if (!params.shiftId) {
        redirect("/dashboard/shifts");
    }

    const [shift, timesheets] = await Promise.all([
        getShiftById(params.shiftId),
        getShiftTimesheets(params.shiftId)
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
