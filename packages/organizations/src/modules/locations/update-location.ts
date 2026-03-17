import { db, toLatLng } from "@repo/database";
import { location } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { AppError } from "@repo/observability";
import { LocationSchema } from "../../schemas";
import { geocodeAddress } from "./geocoding";

export const updateLocation = async (data: unknown, id: string, orgId: string) => {
    const validatedData = LocationSchema.partial().parse(data);

    const existing = await db.query.location.findFirst({
        where: and(
            eq(location.id, id),
            eq(location.organizationId, orgId)
        )
    });

    if (!existing) {
        throw new AppError("Location not found", "NOT_FOUND", 404);
    }

    let positionUpdate = {};
    let addressUpdate = {};

    if (validatedData.address && validatedData.address !== existing.address) {
        const geocodeResult = await geocodeAddress(validatedData.address);

        if (!geocodeResult.success) {
            console.warn(`[UPDATE-LOC] Geocoding failed for ${validatedData.address}, keeping old coords if any`);
        } else {
            const coords = geocodeResult.data;
            positionUpdate = {
                position: toLatLng(Number(coords.latitude), Number(coords.longitude)),
                geocodedAt: new Date(),
                geocodeSource: coords.source,
            };
            addressUpdate = {
                address: coords.formattedAddress
            };
        }
    }

    const updated = await db
        .update(location)
        .set({
            ...validatedData,
            ...addressUpdate,
            ...positionUpdate,
            updatedAt: new Date(),
        })
        .where(eq(location.id, id))
        .returning();

    return updated[0];
};
