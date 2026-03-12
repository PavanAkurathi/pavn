import { getShifts } from "@/lib/api/shifts";
import { transformDraftsToForm } from "@/lib/transformers/draft-to-form";
import { CreateScheduleForm } from "../../../../../components/schedule/create-schedule-form";
import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@repo/database";
import { member, user, workerRole } from "@repo/database/schema";
import { eq, and, ne } from "@repo/database";
import { deriveCrewRoles } from "@/lib/schedule/roles";

export default async function CreateSchedulePage() {
    // 0. Auth Check & Org ID
    const sessionResponse = await auth.api.getSession({
        headers: await headers()
    });

    if (!sessionResponse) {
        redirect("/auth/sign-in");
    }

    const { user: currentUser, session } = sessionResponse;
    // Better-auth v1.2.0 compatibility: explicit cast for activeOrganizationId
    let activeOrgId = (session as any).activeOrganizationId as string || undefined;

    if (!activeOrgId) {
        const membership = await db.query.member.findFirst({
            where: eq(member.userId, currentUser.id)
        });
        if (membership) {
            activeOrgId = membership.organizationId;
        } else {
            return <div>No active organization</div>;
        }
    }

    // 1. Fetch Drafts
    const draftShifts = await getShifts({ view: 'draft' });

    // 2. Fetch Crew (Server Side)
    // Reusing logic from RostersPage to ensure consistency
    const [workersResult, explicitRoles] = await Promise.all([
        db.select({
            id: member.id,
            role: member.role,
            jobTitle: member.jobTitle,
            user: {
                id: user.id,
                name: user.name,
                image: user.image,
            }
        })
            .from(member)
            .leftJoin(user, eq(member.userId, user.id))
            .where(and(
                eq(member.organizationId, activeOrgId),
                ne(member.role, "owner"),
                ne(member.role, "admin")
            )),
        db.query.workerRole.findMany({
            where: eq(workerRole.organizationId, activeOrgId),
            columns: {
                workerId: true,
                role: true,
            },
        }),
    ]);

    const rolesByWorker = new Map<string, string[]>();
    for (const roleRow of explicitRoles) {
        const list = rolesByWorker.get(roleRow.workerId) || [];
        list.push(roleRow.role);
        rolesByWorker.set(roleRow.workerId, list);
    }

    // Map to CrewMember interface expected by UI
    const prefetchedCrew = workersResult
        .filter(r => r.user !== null)
        .map(r => ({
            id: r.user!.id,
            memberId: r.id,
            name: r.user!.name,
            avatar: r.user!.image || "",
            initials: r.user!.name.charAt(0).toUpperCase(),
            roles: deriveCrewRoles(
                rolesByWorker.get(r.user!.id) || [],
                r.jobTitle || null
            ),
            hours: 0 // Placeholder for now
        }));

    // 3. Transform to Form Data
    const initialData = transformDraftsToForm(draftShifts);

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
