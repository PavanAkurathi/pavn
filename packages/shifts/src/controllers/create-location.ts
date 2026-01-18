
import { db } from "@repo/database";
import { location } from "@repo/database/schema";
import { geocodeAddress } from "../services/geocoding";
import { z } from "zod";
import { nanoid } from "nanoid";

const CreateLocationSchema = z.object({
    name: z.string().min(1).max(200),
    address: z.string().min(5).max(500),
    geofenceRadius: z.number().min(50).max(1000).optional().default(150),
    geofenceRadiusMeters: z.number().optional() // Backwards compatibility if FE sends old name
});

export const createLocationController = async (req: Request, orgId: string): Promise<Response> => {
    try {
        const body = await req.json();
        const parsed = CreateLocationSchema.safeParse(body);

        if (!parsed.success) {
            return Response.json({
                error: "Validation failed",
                details: parsed.error.flatten()
            }, { status: 400 });
        }

        const { name, address, geofenceRadius, geofenceRadiusMeters } = parsed.data;
        const finalRadius = geofenceRadiusMeters || geofenceRadius; // Prefer old if sent, though schema handles default

        // Geocode the address
        const geocodeResult = await geocodeAddress(address);

        if (!geocodeResult.success) {
            return Response.json({
                error: geocodeResult.error || "Could not verify address. Please check and try again.",
                code: geocodeResult.code || "GEOCODING_FAILED"
            }, { status: 400 });
        }

        const coords = geocodeResult.data;

        // Warn if low confidence
        if (coords.confidence === 'low') {
            console.warn(`[GEOCODE] Low confidence for "${address}"`);
        }

        // Create location
        const locationId = nanoid();

        // Generate slug from name
        const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const slug = `${baseSlug}-${nanoid(4)}`;

        await db.insert(location).values({
            id: locationId,
            organizationId: orgId,
            name,
            slug,
            address: coords.formattedAddress, // Use normalized address
            latitude: coords.latitude,
            longitude: coords.longitude,
            geofenceRadius: finalRadius,
            geocodedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
        });

        return Response.json({
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
        }, { status: 201 });

    } catch (error) {
        console.error("Create location error:", error);
        return Response.json({
            error: "Failed to create location"
        }, { status: 500 });
    }
};
