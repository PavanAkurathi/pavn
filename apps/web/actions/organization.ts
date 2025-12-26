// apps/web/actions/organization.ts

"use server";

import { db } from "@repo/database";
import { organization } from "@repo/database/schema";
import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function getSession() {
    return await auth.api.getSession({
        headers: await headers()
    });
}

const updateOrgSchema = z.object({
    name: z.string().min(2).max(50),
    metadata: z.string().optional()
});

export async function updateOrganization(data: z.infer<typeof updateOrgSchema>) {
    const session = await getSession();
    if (!session?.session.activeOrganizationId) {
        return { error: "No active organization" };
    }

    const valResult = updateOrgSchema.safeParse(data);
    if (!valResult.success) {
        return { error: "Invalid input: " + (valResult.error.issues[0]?.message || "Unknown error") };
    }
    const safeData = valResult.data;

    try {
        await db.update(organization)
            .set({
                name: safeData.name,
                metadata: safeData.metadata,
            })
            .where(eq(organization.id, session.session.activeOrganizationId));

        revalidatePath("/settings");
        return { success: true };
    } catch (error) {
        console.error("Failed to update organization:", error);
        return { error: "Failed to update organization" };
    }
}
