import { db } from "@repo/database";
import { location } from "@repo/database/schema";
import { sql } from "drizzle-orm";
import { geocodeAddress } from "../services/geocoding";
import { z } from "zod";

import { AppError } from "@repo/observability";

import { newId } from "../utils/ids";

import { createLocationSchema } from "../schemas";

export const createLocation = async (body: any, orgId: string) => {
    const parsed = createLocationSchema.safeParse(body);

    if (!parsed.success) {
        throw new AppError("Validation failed", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const { name, address, timezone, geofenceRadius, geofenceRadiusMeters } = parsed.data;
    const finalRadius = geofenceRadiusMeters || geofenceRadius; // Prefer old if sent, though schema handles default

    // Geocode the address
    const geocodeResult = await geocodeAddress(address);

    if (!geocodeResult.success) {
        const failure = geocodeResult as any;
        throw new AppError(
            failure.error || "Could not verify address. Please check and try again.",
            failure.code || "GEOCODING_FAILED",
            400
        );
    }

    const coords = geocodeResult.data;

    // Warn if low confidence
    if (coords.confidence === 'low') {
        console.warn(`[GEOCODE] Low confidence for "${address}"`);
    }

    // Create location
    const locationId = newId('loc');

    // Generate slug from name
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const slug = `${baseSlug}-${locationId.slice(-6)}`;

    await db.insert(location).values({
        id: locationId,
        organizationId: orgId,
        name,
        slug,
        timezone,
        address: coords.formattedAddress, // Use normalized address
        position: sql`ST_GeogFromText(${`POINT(${coords.longitude} ${coords.latitude})`})`,
        geofenceRadius: finalRadius,
        geocodedAt: new Date(),
        geocodeSource: coords.source,
        createdAt: new Date(),
        updatedAt: new Date()
    });

    return {
        success: true,
        location: {
            id: locationId,
            name,
            address: coords.formattedAddress,
            latitude: coords.latitude,
            longitude: coords.longitude,
            geofenceRadius: finalRadius,
            confidence: coords.confidence
        }
    };
};
