import { getShifts } from "@/lib/api/shifts";
import { transformDraftsToForm } from "@/lib/transformers/draft-to-form";
import { CreateScheduleForm } from "../../../../../components/schedule/create-schedule-form";

export default async function CreateSchedulePage() {
    // 1. Fetch Drafts
    const draftShifts = await getShifts({ view: 'draft' });

    // 2. Transform to Form Data
    const initialData = transformDraftsToForm(draftShifts);

    return (
        <div className="container flex flex-col items-center justify-center min-h-screen max-w-3xl py-10">
            <div className="w-full">
                <CreateScheduleForm initialData={initialData} />
            </div>
        </div>
    );
}
