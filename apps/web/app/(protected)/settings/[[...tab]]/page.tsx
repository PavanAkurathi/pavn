// apps/web/app/(protected)/settings/[[...tab]]/page.tsx

import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@repo/database";
import {
    organization as orgSchema,
    location as locSchema,
    member as memberSchema,
    session as sessionSchema,
    account as accountSchema,
    user as userSchema
} from "@repo/database/schema";
import { eq, and, desc, or } from "drizzle-orm";
import { SettingsView } from "@/components/settings/settings-view";
import { getSubscriptionDetails, getInvoiceHistory } from "@/actions/billing";

export default async function SettingsPage(props: { params: Promise<{ tab?: string[] }> }) {
    const params = await props.params;
    const activeTab = params.tab?.[0] || "profile";

    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        redirect("/auth/login");
    }

    let activeOrgId = session.session.activeOrganizationId;
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
            user: {
                id: userSchema.id,
                name: userSchema.name,
                email: userSchema.email,
                image: userSchema.image
            }
        })
            .from(memberSchema)
            .leftJoin(userSchema, eq(memberSchema.userId, userSchema.id))
            .where(and(
                eq(memberSchema.organizationId, activeOrgId),
                or(eq(memberSchema.role, "admin"), eq(memberSchema.role, "owner"))
            ));

        members = teamResult
            .filter(r => r.user !== null)
            .map(r => ({
                id: r.id,
                role: r.role || "member",
                joinedAt: r.joinedAt,
                name: r.user!.name,
                email: r.user!.email,
                image: r.user!.image
            }));
    }

    const accounts = await db.select()
        .from(accountSchema)
        .where(eq(accountSchema.userId, session.user.id));

    const sessions = await db.select()
        .from(sessionSchema)
        .where(eq(sessionSchema.userId, session.user.id))
        .orderBy(desc(sessionSchema.createdAt));

    // Parallel Fetch for Billing Data
    const [subscription, invoices] = await Promise.all([
        getSubscriptionDetails(),
        getInvoiceHistory()
    ]);

    return (
        <SettingsView
            activeTab={activeTab}
            user={{
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
            subscription={subscription}
            invoices={invoices}
        />
    );
}