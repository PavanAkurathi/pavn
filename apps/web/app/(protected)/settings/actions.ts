"use server";

import { db } from "@repo/database";
import { organization, location } from "@repo/database/schema";
import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";

// Helper to get current session securely
async function getSession() {
    return await auth.api.getSession({
        headers: await headers()
    });
}

// ============================================================================
// Organization Actions
// ============================================================================

export async function updateOrganization(data: { name: string; metadata?: string }) {
    const session = await getSession();
    if (!session?.session.activeOrganizationId) {
        return { error: "No active organization" };
    }

    try {
        await db.update(organization)
            .set({
                name: data.name,
                metadata: data.metadata,
            })
            .where(eq(organization.id, session.session.activeOrganizationId));

        revalidatePath("/settings");
        return { success: true };
    } catch (error) {
        console.error("Failed to update organization:", error);
        return { error: "Failed to update organization" };
    }
}

// ============================================================================
// Location Actions
// ============================================================================

export async function createLocation(data: { name: string; address: string; timezone?: string }) {
    const session = await getSession();
    if (!session?.session.activeOrganizationId) {
        return { error: "No active organization" };
    }

    try {
        await db.insert(location).values({
            id: nanoid(),
            organizationId: session.session.activeOrganizationId,
            name: data.name,
            address: data.address,
            slug: data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), // Simple slug gen
            timezone: data.timezone || "UTC",
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        revalidatePath("/settings");
        return { success: true };
    } catch (error) {
        console.error("Failed to create location:", error);
        return { error: "Failed to create location" };
    }
}

export async function deleteLocation(locationId: string) {
    const session = await getSession();
    if (!session?.session.activeOrganizationId) {
        return { error: "No active organization" };
    }

    try {
        // Ensure we only delete locations belonging to the active org
        await db.delete(location)
            .where(and(
                eq(location.id, locationId),
                eq(location.organizationId, session.session.activeOrganizationId)
            ));

        revalidatePath("/settings");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete location:", error);
        return { error: "Failed to delete location" };
    }
}
