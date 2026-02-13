import { db } from "@repo/database";
import { location } from "@repo/database/schema";
import { eq, and, sql } from "drizzle-orm";
import { LocationSchema } from "../../schemas";
import { geocodeAddress } from "./geocoding";
import { AppError } from "@repo/observability";

export const updateLocation = async (data: any, id: string, orgId: string) => {
    const validatedData = LocationSchema.partial().parse(data);

    // Ensure location belongs to org
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

    // Re-geocode if address changes
    if (validatedData.address && validatedData.address !== existing.address) {
        const geocodeResult = await geocodeAddress(validatedData.address);

        if (!geocodeResult.success) {
            console.warn(`[UPDATE-LOC] Geocoding failed for ${validatedData.address}, keeping old coords if any`);
            // Option: Throw error if strict, or allow address update with stale coords (risky for geofence)
            // MVP Decision: Warn but update address. User can fix later.
            // Ideally we should throw, but geocoding services can be flaky.
        } else {
            const coords = geocodeResult.data;
            positionUpdate = {
                position: sql`ST_GeogFromText(${`POINT(${coords.longitude} ${coords.latitude})`})`,
                geocodedAt: new Date(),
                geocodeSource: coords.source,
                latitude: coords.latitude, // if schema has these
                longitude: coords.longitude
            };
            addressUpdate = {
                address: coords.formattedAddress // Use normalized
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
