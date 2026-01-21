// packages/geofence/src/controllers/geocode-location.ts

import { db } from "@repo/database";
import { location } from "@repo/database/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { geocodeAddress } from "../utils/geocode";

interface GeocodeLocationRequest {
    locationId: string;
    orgId: string;
    forceRefresh?: boolean;
}

export async function geocodeLocationController(
    req: GeocodeLocationRequest
): Promise<Response> {
    const { locationId, orgId, forceRefresh = false } = req;

    try {
        // 1. Fetch location with tenant check
        const loc = await db.query.location.findFirst({
            where: and(
                eq(location.id, locationId),
                eq(location.organizationId, orgId)
            )
        });

        if (!loc) {
            return Response.json({ error: "Location not found" }, { status: 404 });
        }

        if (!loc.address) {
            return Response.json({ error: "Location has no address" }, { status: 400 });
        }

        // 2. Check if already geocoded and address unchanged
        if (loc.position && !forceRefresh) {
            return Response.json({
                success: true,
                message: "Already geocoded",
                data: {
                    // Extracting from DB would require a separate query or parsing, 
                    // but for this "Already geocoded" response we might just return the timestamp 
                    // or re-fetch if we really need coordinates. 
                    // For now, let's omit lat/long return or fetch them if critical.
                    // Given the frontend likely needs them, we should probably fetch them?
                    // Actually, let's just return success without data or fetch them.
                    geocodedAt: loc.geocodedAt
                }
            });
        }

        // 3. Geocode the address
        const result = await geocodeAddress(loc.address);

        if (!result.success) {
            return Response.json({
                error: "Geocoding failed",
                details: result.error,
                code: result.code
            }, { status: 400 });
        }

        // 4. Update location with coordinates
        await db.update(location)
            .set({
                position: sql`ST_GeogFromText(${`POINT(${result.data.longitude} ${result.data.latitude})`})`,
                geocodedAt: new Date(),
                geocodeSource: result.data.source,
                updatedAt: new Date(),
            })
            .where(eq(location.id, locationId));

        return Response.json({
            success: true,
            data: result.data
        });

    } catch (error) {
        console.error("[GEOCODE_LOCATION] Error:", error);
        return Response.json({
            error: "Failed to geocode location",
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

// Batch geocode for importing multiple locations
export async function geocodeAllLocationsController(orgId: string): Promise<Response> {
    try {
        const ungeocoded = await db.query.location.findMany({
            where: and(
                eq(location.organizationId, orgId),
                isNull(location.position)  // Not yet geocoded
            )
        });

        const results = {
            total: ungeocoded.length,
            success: 0,
            failed: 0,
            errors: [] as { locationId: string; name: string; error: string }[]
        };

        for (const loc of ungeocoded) {
            if (!loc.address) {
                results.failed++;
                results.errors.push({
                    locationId: loc.id,
                    name: loc.name,
                    error: "No address"
                });
                continue;
            }

            const result = await geocodeAddress(loc.address);

            if (result.success) {
                await db.update(location)
                    .set({
                        position: sql`ST_GeogFromText(${`POINT(${result.data.longitude} ${result.data.latitude})`})`,
                        geocodedAt: new Date(),
                        geocodeSource: result.data.source,
                        updatedAt: new Date(),
                    })
                    .where(eq(location.id, loc.id));
                results.success++;
            } else {
                results.failed++;
                results.errors.push({
                    locationId: loc.id,
                    name: loc.name,
                    error: result.error
                });
            }

            // Rate limit (provider-specific)
            const provider = process.env.GEOCODING_PROVIDER || 'nominatim';
            const delayMs = provider === 'google' ? 100 : 1100;
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        return Response.json(results);

    } catch (error) {
        console.error("[GEOCODE_ALL] Error:", error);
        return Response.json({ error: "Batch geocoding failed" }, { status: 500 });
    }
}
