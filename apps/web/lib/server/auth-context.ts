import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveActiveOrganizationId } from "@/lib/active-organization";

type AppSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export function getSessionActiveOrganizationId(session: AppSession): string | undefined {
    const sessionData = session as any;
    return sessionData?.session?.activeOrganizationId || sessionData?.activeOrganizationId || undefined;
}

export async function getRequiredSession(redirectTo: string = "/auth/login"): Promise<AppSession> {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        redirect(redirectTo);
    }

    return session;
}

export async function getRequiredOrganizationContext(options?: {
    loginRedirectTo?: string;
    missingOrganizationRedirectTo?: string;
}) {
    const session = await getRequiredSession(options?.loginRedirectTo);
    const activeOrgId = await resolveActiveOrganizationId(
        session.user.id,
        getSessionActiveOrganizationId(session)
    );

    if (!activeOrgId) {
        redirect(options?.missingOrganizationRedirectTo || "/dashboard/onboarding");
    }

    return {
        session,
        activeOrgId,
    };
}
