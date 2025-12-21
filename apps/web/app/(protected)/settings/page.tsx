import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@repo/database";
import { organization as orgSchema, location as locSchema } from "@repo/database/schema";
import { eq } from "drizzle-orm";
import { SettingsView } from "@/components/settings/settings-view";

export default async function SettingsPage() {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        redirect("/auth/login");
    }

    const activeOrgId = session.session.activeOrganizationId;
    let organization = null;
    let locations: any[] = [];

    if (activeOrgId) {
        // Fetch Organization
        const orgResult = await db.select().from(orgSchema).where(eq(orgSchema.id, activeOrgId)).limit(1);
        organization = orgResult[0] || null;

        // Fetch Locations
        locations = await db.select().from(locSchema).where(eq(locSchema.organizationId, activeOrgId));
    }

    return (
        <SettingsView
            user={{
                name: session.user.name,
                email: session.user.email,
                image: session.user.image,
                phoneNumber: (session.user as any).phoneNumber // Cast as any if type definition lags
            }}
            organization={organization}
            locations={locations}
        />
    );
}
