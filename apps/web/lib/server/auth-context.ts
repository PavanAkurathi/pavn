import type { Session } from "@repo/auth/client";
import { redirect } from "next/navigation";
import { resolveActiveOrganizationId } from "@/lib/active-organization";
import { getAuthLoginHref, getOnboardingHref } from "@/lib/routes";
import { getApiSession } from "@/lib/server/auth-session";

type AppSession = Session;

export function getSessionActiveOrganizationId(session: AppSession): string | undefined {
    const sessionData = session as any;
    return sessionData?.session?.activeOrganizationId || sessionData?.activeOrganizationId || undefined;
}

export async function getRequiredSession(redirectTo: string = getAuthLoginHref()): Promise<AppSession> {
    const session = await getApiSession();

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
        redirect(options?.missingOrganizationRedirectTo || getOnboardingHref());
    }

    return {
        session,
        activeOrgId,
    };
}
