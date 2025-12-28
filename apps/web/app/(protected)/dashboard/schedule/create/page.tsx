// apps/web/app/(protected)/dashboard/schedule/create/page.tsx

import { CreateScheduleForm } from "../../../../../components/schedule/create-schedule-form";

export default function CreateSchedulePage() {
    return (
        <div className="container flex flex-col items-center justify-center min-h-screen max-w-3xl py-10">
            <div className="w-full mb-8">
                <h1 className="text-2xl font-bold tracking-tight">Create Schedule</h1>
                <p className="text-muted-foreground">
                    Set up a new shift schedule for your team and location.
                </p>
            </div>

            <div className="w-full">
                <CreateScheduleForm />
            </div>
        </div>
    );
}
