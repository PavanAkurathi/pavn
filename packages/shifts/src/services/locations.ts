
import { db } from "@repo/database";
import { location } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

export const createLocationSchema = z.object({
    name: z.string().min(2).max(50),
    address: z.string().min(5),
    zip: z.string().optional(),
    timezone: z.string().optional().default("UTC"),
    parking: z.string().default("free"),
    specifics: z.array(z.string()).default([]),
    instructions: z.string().optional()
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;

export class LocationService {
    static async create(orgId: string, data: CreateLocationInput) {
        const valResult = createLocationSchema.safeParse(data);
        if (!valResult.success) {
            throw new Error("Invalid input: " + (valResult.error.issues[0]?.message || "Unknown error"));
        }
        const safeData = valResult.data;

        await db.insert(location).values({
            id: nanoid(),
            organizationId: orgId,
            name: safeData.name,
            address: safeData.address,
            zip: safeData.zip,
            slug: safeData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            timezone: safeData.timezone,
            parking: safeData.parking,
            specifics: safeData.specifics,
            instructions: safeData.instructions,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    }

    static async update(orgId: string, locationId: string, data: CreateLocationInput) {
        const valResult = createLocationSchema.safeParse(data);
        if (!valResult.success) {
            throw new Error("Invalid input: " + (valResult.error.issues[0]?.message || "Unknown error"));
        }
        const safeData = valResult.data;

        await db.update(location)
            .set({
                name: safeData.name,
                address: safeData.address,
                zip: safeData.zip,
                timezone: safeData.timezone,
                parking: safeData.parking,
                specifics: safeData.specifics,
                instructions: safeData.instructions,
                updatedAt: new Date(),
            })
            .where(and(
                eq(location.id, locationId),
                eq(location.organizationId, orgId)
            ));
    }

    static async delete(orgId: string, locationId: string) {
        await db.delete(location)
            .where(and(
                eq(location.id, locationId),
                eq(location.organizationId, orgId)
            ));
    }
}
