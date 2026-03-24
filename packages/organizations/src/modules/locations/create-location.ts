import { db, toLatLng } from "@repo/database";
import { location } from "@repo/database/schema";
import { AppError } from "@repo/observability";
import { geocodeAddress } from "./geocoding";
import { newId } from "../../utils/ids";
import { createLocationSchema } from "../../schemas";

export const createLocation = async (body: unknown, orgId: string) => {
    const parsed = createLocationSchema.safeParse(body);

    if (!parsed.success) {
        throw new AppError("Validation failed", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const { name, address, timezone, geofenceRadius, geofenceRadiusMeters } = parsed.data;
    const finalRadius = geofenceRadiusMeters || geofenceRadius;

    const geocodeResult = await geocodeAddress(address);
    const coords = geocodeResult.success ? geocodeResult.data : null;

    if (!geocodeResult.success) {
        console.warn(`[CREATE-LOC] Geocoding failed for "${address}", saving raw address without coordinates`);
    } else if (geocodeResult.data.confidence === "low") {
        console.warn(`[GEOCODE] Low confidence for "${address}"`);
    }

    const locationId = newId("loc");
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const slug = `${baseSlug}-${locationId.slice(-6)}`;

    await db.insert(location).values({
        id: locationId,
        organizationId: orgId,
        name,
        slug,
        timezone,
        address: coords?.formattedAddress ?? address,
        position: coords ? toLatLng(Number(coords.latitude), Number(coords.longitude)) : null,
        geofenceRadius: finalRadius,
        geocodedAt: coords ? new Date() : null,
        geocodeSource: coords?.source ?? null,
        createdAt: new Date(),
        updatedAt: new Date()
    });

    return {
        success: true,
        location: {
            id: locationId,
            name,
            address: coords?.formattedAddress ?? address,
            latitude: coords?.latitude ?? null,
            longitude: coords?.longitude ?? null,
            geofenceRadius: finalRadius,
            confidence: coords?.confidence ?? null
        },
        warning: coords
            ? undefined
            : "Location saved without verified coordinates. You can refine geofence details later in Settings."
    };
};
