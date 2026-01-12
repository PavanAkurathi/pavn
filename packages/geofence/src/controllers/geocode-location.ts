// packages/geofence/src/controllers/geocode-location.ts

import { db } from "@repo/database";
import { location } from "@repo/database/schema";
import { eq, and, isNull } from "drizzle-orm";
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
        if (loc.latitude && loc.longitude && !forceRefresh) {
            return Response.json({
                success: true,
                message: "Already geocoded",
                data: {
                    latitude: loc.latitude,
                    longitude: loc.longitude,
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
                latitude: result.data.latitude,
                longitude: result.data.longitude,
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
                isNull(location.latitude)  // Not yet geocoded
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
                        latitude: result.data.latitude,
                        longitude: result.data.longitude,
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

            // Rate limit
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return Response.json(results);

    } catch (error) {
        console.error("[GEOCODE_ALL] Error:", error);
        return Response.json({ error: "Batch geocoding failed" }, { status: 500 });
    }
}
