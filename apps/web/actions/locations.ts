// apps/web/actions/locations.ts

"use server";

import { db } from "@repo/database";
import { location } from "@repo/database/schema";
import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { z } from "zod";

async function getSession() {
    return await auth.api.getSession({
        headers: await headers()
    });
}

const createLocationSchema = z.object({
    name: z.string().min(2).max(50),
    address: z.string().min(5),
    zip: z.string().optional(),
    timezone: z.string().optional().default("UTC"),
    parking: z.string().default("free"),
    specifics: z.array(z.string()).default([]),
    instructions: z.string().optional()
});

export async function createLocation(data: z.infer<typeof createLocationSchema>) {
    const session = await getSession();
    // Better-auth v1.2.0 compatibility: explicit cast for activeOrganizationId
    const activeOrganizationId = (session?.session as any)?.activeOrganizationId as string | undefined;

    if (!activeOrganizationId) {
        return { error: "No active organization" };
    }

    const valResult = createLocationSchema.safeParse(data);
    if (!valResult.success) {
        return { error: "Invalid input: " + (valResult.error.issues[0]?.message || "Unknown error") };
    }
    const safeData = valResult.data;

    try {
        await db.insert(location).values({
            id: nanoid(),
            organizationId: activeOrganizationId,
            name: safeData.name,
            address: safeData.address,
            zip: safeData.zip, // Stored separately now
            slug: safeData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            timezone: safeData.timezone,
            parking: safeData.parking,
            specifics: safeData.specifics,
            instructions: safeData.instructions,
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

export async function updateLocation(id: string, data: z.infer<typeof createLocationSchema>) {
    const session = await getSession();
    // Better-auth v1.2.0 compatibility: explicit cast for activeOrganizationId
    const activeOrganizationId = (session?.session as any)?.activeOrganizationId as string | undefined;

    if (!activeOrganizationId) {
        return { error: "No active organization" };
    }

    const valResult = createLocationSchema.safeParse(data);
    if (!valResult.success) {
        return { error: "Invalid input: " + (valResult.error.issues[0]?.message || "Unknown error") };
    }
    const safeData = valResult.data;

    try {
        await db.update(location)
            .set({
                name: safeData.name,
                address: safeData.address,
                zip: safeData.zip, // Stored separately now
                timezone: safeData.timezone,
                parking: safeData.parking,
                specifics: safeData.specifics,
                instructions: safeData.instructions,
                updatedAt: new Date(),
            })
            .where(and(
                eq(location.id, id),
                eq(location.organizationId, activeOrganizationId)
            ));

        revalidatePath("/settings");
        return { success: true };
    } catch (error) {
        console.error("Failed to update location:", error);
        return { error: "Failed to update location" };
    }
}

export async function deleteLocation(locationId: string) {
    const session = await getSession();
    // Better-auth v1.2.0 compatibility: explicit cast for activeOrganizationId
    const activeOrganizationId = (session?.session as any)?.activeOrganizationId as string | undefined;

    if (!activeOrganizationId) {
        return { error: "No active organization" };
    }

    try {
        await db.delete(location)
            .where(and(
                eq(location.id, locationId),
                eq(location.organizationId, activeOrganizationId)
            ));

        revalidatePath("/settings");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete location:", error);
        return { error: "Failed to delete location" };
    }
}
