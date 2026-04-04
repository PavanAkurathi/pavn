import { getShifts } from "@/lib/api/shifts";
import { getScheduleBootstrap } from "@/lib/api/organizations";
import { transformDraftsToForm } from "@/lib/transformers/draft-to-form";
import { CreateScheduleForm } from "../../../../../components/schedule/create-schedule-form";
import { getRequiredOrganizationContext } from "@/lib/server/auth-context";

export default async function CreateSchedulePage() {
    const { activeOrgId } = await getRequiredOrganizationContext();

    const [draftShifts, scheduleBootstrap] = await Promise.all([
        getShifts({ view: 'draft', orgId: activeOrgId }),
        getScheduleBootstrap(activeOrgId),
    ]);

    // 3. Transform to Form Data
    const initialData = transformDraftsToForm(draftShifts);
    const prefetchedCrew = scheduleBootstrap.crew.map((worker) => ({
        id: worker.id,
        memberId: worker.memberId,
        name: worker.name,
        avatar: worker.avatar || worker.image || "",
        roles: worker.roles || (worker.role ? [worker.role] : []),
        hours: worker.hours || 0,
        initials:
            worker.initials ||
            worker.name
                .split(" ")
                .map((part) => part[0] || "")
                .join("")
                .slice(0, 2)
                .toUpperCase(),
    }));

    return (
        <div className="container flex flex-col items-center justify-center min-h-screen max-w-3xl py-10">
            <div className="w-full">
                <CreateScheduleForm
                    initialData={initialData}
                    prefetchedCrew={prefetchedCrew}
                />
            </div>
        </div>
    );
}
