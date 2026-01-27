import { getShifts } from "@/lib/api/shifts";
import { transformDraftsToForm } from "@/lib/transformers/draft-to-form";
import { CreateScheduleForm } from "../../../../../components/schedule/create-schedule-form";
import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@repo/database";
import { member, user } from "@repo/database/schema";
import { eq, and, ne } from "@repo/database";

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
    const workersResult = await db.select({
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
        ));

    // Map to CrewMember interface expected by UI
    const prefetchedCrew = workersResult
        .filter(r => r.user !== null)
        .map(r => ({
            id: r.id,
            name: r.user!.name,
            avatar: r.user!.image || "",
            initials: r.user!.name.charAt(0).toUpperCase(),
            title: r.jobTitle,
            roles: (() => {
                // 1. Try smart matching on Job Title
                const t = (r.jobTitle || "").toLowerCase();
                if (t.includes("server")) return ["server"];
                if (t.includes("bartender") || t.includes("bar")) return ["bartender"];
                if (t.includes("chef") || t.includes("cook") || t.includes("kitchen") || t.includes("dish")) return ["kitchen"];
                if (t.includes("host")) return ["host"];

                // 2. Fallback to DB Role (since jobTitle is currently null in mock data)
                const dbRole = (r.role || "").toLowerCase();
                if (dbRole === "server") return ["server"];
                if (dbRole === "bartender") return ["bartender"];
                if (dbRole === "kitchen") return ["kitchen"];
                if (dbRole === "host") return ["host"];

                return ["member"];
            })(),
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
