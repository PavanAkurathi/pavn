// packages/geofence/src/services/geocode-location.ts

import { db } from "@repo/database";
import { location } from "@repo/database/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { geocodeAddress } from "../utils/geocode";
import { AppError } from "@repo/observability";

export const geocodeLocation = async (locationId: string, orgId: string, forceRefresh = false) => {
    // 1. Fetch location
    const loc = await db.query.location.findFirst({
        where: and(
            eq(location.id, locationId),
            eq(location.organizationId, orgId)
        )
    });

    if (!loc) {
        throw new AppError("Location not found", "NOT_FOUND", 404);
    }

    if (!loc.address) {
        throw new AppError("Location has no address", "INVALID_DATA", 400);
    }

    // 2. Already geocoded?
    if (loc.position && !forceRefresh) {
        return {
            success: true,
            message: "Already geocoded",
            data: { geocodedAt: loc.geocodedAt }
        };
    }

    // 3. Geocode
    const result = await geocodeAddress(loc.address);

    if (result.success === false) {
        throw new AppError("Geocoding failed", "GEOCODE_ERROR", 400, {
            error: result.error,
            code: result.code
        });
    }

    // 4. Update
    await db.update(location)
        .set({
            position: sql`ST_GeogFromText(${`POINT(${result.data.longitude} ${result.data.latitude})`})`,
            geocodedAt: new Date(),
            geocodeSource: result.data.source,
            updatedAt: new Date(),
        })
        .where(eq(location.id, locationId));

    return {
        success: true,
        data: result.data
    };
};

export const geocodeAllLocations = async (orgId: string) => {
    const ungeocoded = await db.query.location.findMany({
        where: and(
            eq(location.organizationId, orgId),
            isNull(location.position)
        )
    });

    const results = {
        total: ungeocoded.length,
        success: 0,
        failed: 0,
        errors: [] as any[]
    };

    for (const loc of ungeocoded) {
        if (!loc.address) {
            results.failed++;
            results.errors.push({ locationId: loc.id, name: loc.name, error: "No address" });
            continue;
        }

        const result = await geocodeAddress(loc.address);

        if (result.success === false) {
            results.failed++;
            results.errors.push({ locationId: loc.id, name: loc.name, error: result.error });
        } else {
            await db.update(location)
                .set({
                    position: sql`ST_GeogFromText(${`POINT(${result.data.longitude} ${result.data.latitude})`})`,
                    geocodedAt: new Date(),
                    geocodeSource: result.data.source,
                    updatedAt: new Date(),
                })
                .where(eq(location.id, loc.id));
            results.success++;
        }

        // Rate limit
        const provider = process.env.GEOCODING_PROVIDER || 'nominatim';
        const delayMs = provider === 'google' ? 100 : 1100;
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    return results;
};
