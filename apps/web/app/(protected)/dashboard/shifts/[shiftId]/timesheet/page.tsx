import { ShiftDetailView } from "@/components/shifts/shift-detail-view";
import { redirect } from "next/navigation";

interface PageProps {
    params: {
        shiftId: string;
    };
}

export default function ShiftTimesheetPage({ params }: PageProps) {
    if (!params.shiftId) {
        redirect("/dashboard/shifts");
    }

    return (
        <ShiftDetailView
            shiftId={params.shiftId}
            onBack={() => window.history.back()}
        />
    );
}
