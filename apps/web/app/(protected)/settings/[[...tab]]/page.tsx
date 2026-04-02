// apps/web/app/(protected)/settings/[[...tab]]/page.tsx

import { db } from "@repo/database";
import {
    invitation as invitationSchema,
    organization as orgSchema,
    location as locSchema,
    member as memberSchema,
    session as sessionSchema,
    account as accountSchema,
    user as userSchema
} from "@repo/database/schema";
import { eq, and, desc, or } from "@repo/database";
import { SettingsView } from "@/components/settings/settings-view";
import { getSubscriptionDetails, getInvoiceHistory } from "@/actions/billing";
import { getRequiredSession, getSessionActiveOrganizationId } from "@/lib/server/auth-context";
import { isAdminOrganizationRole } from "@/lib/server/organization-roles";

export default async function SettingsPage(props: { params: Promise<{ tab?: string[] }> }) {
    const params = await props.params;
    const activeTab = params.tab?.[0] || "profile";

    const session = await getRequiredSession();

    let activeOrgId = getSessionActiveOrganizationId(session);
    let organization = null;
    let locations: any[] = [];
    let role = "member";
    let members: any[] = [];

    // Auto-select Organization if none active
    if (!activeOrgId) {
        const memberRecord = await db.select()
            .from(memberSchema)
            .where(eq(memberSchema.userId, session.user.id))
            .limit(1);

        if (memberRecord[0]) {
            activeOrgId = memberRecord[0].organizationId;
            await db.update(sessionSchema)
                .set({ activeOrganizationId: activeOrgId })
                .where(eq(sessionSchema.id, session.session.id));
        }
    }

    if (activeOrgId) {
        const orgResult = await db.select().from(orgSchema).where(eq(orgSchema.id, activeOrgId)).limit(1);
        organization = orgResult[0] || null;

        locations = await db.select().from(locSchema).where(eq(locSchema.organizationId, activeOrgId));

        const memberResult = await db.select()
            .from(memberSchema)
            .where(and(
                eq(memberSchema.userId, session.user.id),
                eq(memberSchema.organizationId, activeOrgId)
            ))
            .limit(1);

        if (memberResult[0]) {
            role = memberResult[0].role;
        }

        const teamResult = await db.select({
            id: memberSchema.id,
            role: memberSchema.role,
            joinedAt: memberSchema.createdAt,
            status: memberSchema.status,
            user: {
                id: userSchema.id,
                name: userSchema.name,
                email: userSchema.email,
                image: userSchema.image,
                emailVerified: userSchema.emailVerified
            }
        })
            .from(memberSchema)
            .leftJoin(userSchema, eq(memberSchema.userId, userSchema.id))
            .where(
                eq(memberSchema.organizationId, activeOrgId)
            );

        const pendingInvitations = await db.select({
            id: invitationSchema.id,
            role: invitationSchema.role,
            joinedAt: invitationSchema.createdAt,
            email: invitationSchema.email,
            user: {
                id: userSchema.id,
                name: userSchema.name,
                image: userSchema.image,
            },
        })
            .from(invitationSchema)
            .leftJoin(userSchema, eq(invitationSchema.email, userSchema.email))
            .where(and(
                eq(invitationSchema.organizationId, activeOrgId),
                eq(invitationSchema.status, "pending")
            ));

        members = [
            ...teamResult
            .filter(r => r.user !== null)
            .map(r => ({
                id: r.id,
                entryType: "member" as const,
                role: r.role || "member",
                joinedAt: r.joinedAt,
                name: r.user!.name,
                email: r.user!.email,
                image: r.user!.image,
                status: (r.status === "active" ? "active" : "invited") as "active" | "invited",
                user: {
                    id: r.user!.id,
                },
            })),
            ...pendingInvitations.map((invite) => ({
                id: invite.id,
                entryType: "invitation" as const,
                role: invite.role || "member",
                joinedAt: invite.joinedAt || new Date(),
                name: invite.user?.name || invite.email,
                email: invite.email,
                image: invite.user?.image || null,
                status: "invited" as const,
                user: invite.user ? { id: invite.user.id } : undefined,
            })),
        ].sort((left, right) => right.joinedAt.getTime() - left.joinedAt.getTime());
    }

    const accounts = await db.select()
        .from(accountSchema)
        .where(eq(accountSchema.userId, session.user.id));

    const sessions = await db.select()
        .from(sessionSchema)
        .where(eq(sessionSchema.userId, session.user.id))
        .orderBy(desc(sessionSchema.createdAt));

    const [subscription, invoices] = isAdminOrganizationRole(role) && activeTab === "billing"
        ? await Promise.all([
            getSubscriptionDetails(),
            getInvoiceHistory()
        ])
        : [{ status: "inactive" }, []];

    return (
        <SettingsView
            activeTab={activeTab}
            user={{
                id: session.user.id,
                name: session.user.name,
                email: session.user.email,
                image: session.user.image,
                emailVerified: session.user.emailVerified,
                phoneNumber: (session.user as any).phoneNumber
            }}
            organization={organization}
            locations={locations}
            role={role}
            sessions={sessions}
            accounts={accounts}
            members={members}
            canManageWorkspace={isAdminOrganizationRole(role)}
            subscription={subscription}
            invoices={invoices}
        />
    );
}
