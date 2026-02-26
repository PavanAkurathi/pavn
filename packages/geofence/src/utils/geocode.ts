// packages/geofence/src/utils/geocode.ts

import { z } from "zod";

const GeocodeResultSchema = z.object({
    latitude: z.string(),
    longitude: z.string(),
    formattedAddress: z.string(),
    confidence: z.enum(["high", "medium", "low"]),
    source: z.enum(["google", "nominatim"]),
});

export type GeocodeResult = z.infer<typeof GeocodeResultSchema>;

export interface GeocodeError {
    success: false;
    error: string;
    code: "INVALID_ADDRESS" | "API_ERROR" | "NO_RESULTS" | "MISSING_API_KEY";
}

export type GeocodeResponse =
    | { success: true; data: GeocodeResult }
    | GeocodeError;

export async function geocodeAddress(address: string): Promise<GeocodeResponse> {
    const provider = process.env.GEOCODING_PROVIDER || 'nominatim';

    if (provider === 'google') {
        return geocodeWithGoogle(address);
    } else {
        return geocodeWithNominatim(address);
    }
}

async function geocodeWithGoogle(address: string): Promise<GeocodeResponse> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
        console.error("[GEOCODE] Missing GOOGLE_MAPS_API_KEY");
        return { success: false, error: "Geocoding not configured", code: "MISSING_API_KEY" };
    }

    if (!address || address.trim().length < 5) {
        return { success: false, error: "Address too short", code: "INVALID_ADDRESS" };
    }

    try {
        const encodedAddress = encodeURIComponent(address.trim());
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

        const response = await fetch(url);
        const data = await response.json() as any;

        if (data.status === "ZERO_RESULTS") {
            return { success: false, error: "Address not found", code: "NO_RESULTS" };
        }

        if (data.status !== "OK") {
            console.error("[GEOCODE] Google API Error:", data.status, data.error_message);
            return { success: false, error: data.error_message || "Geocoding failed", code: "API_ERROR" };
        }

        const result = data.results[0];
        const location = result.geometry.location;

        const locationType = result.geometry.location_type;
        let confidence: "high" | "medium" | "low" = "medium";
        if (locationType === "ROOFTOP") confidence = "high";
        if (locationType === "APPROXIMATE") confidence = "low";

        return {
            success: true,
            data: {
                latitude: String(location.lat),
                longitude: String(location.lng),
                formattedAddress: result.formatted_address,
                confidence,
                source: "google",
            }
        };

    } catch (error) {
        console.error("[GEOCODE] Google Exception:", error);
        return { success: false, error: "Geocoding request failed", code: "API_ERROR" };
    }
}

// Global throttling queue for Nominatim to respect 1 req/sec limit
let nominatimQueue = Promise.resolve();

async function geocodeWithNominatim(address: string): Promise<GeocodeResponse> {
    if (!address || address.trim().length < 5) {
        return { success: false, error: "Address too short", code: "INVALID_ADDRESS" };
    }

    // Queue the request
    const result = await new Promise<GeocodeResponse>((resolve) => {
        nominatimQueue = nominatimQueue.then(async () => {
            try {
                // Ensure 1.1s delay between requests
                await new Promise(r => setTimeout(r, 1100));

                const encoded = encodeURIComponent(address);
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`,
                    {
                        headers: {
                            'User-Agent': 'WorkersHive/1.0 (contact@workershive.com)'
                        }
                    }
                );

                const results = await response.json() as any;

                if (!results || results.length === 0) {
                    resolve({ success: false, error: "Address not found", code: "NO_RESULTS" });
                    return;
                }

                const result = results[0];
                resolve({
                    success: true,
                    data: {
                        latitude: result.lat,
                        longitude: result.lon,
                        formattedAddress: result.display_name,
                        confidence: result.importance > 0.5 ? 'high' : 'medium',
                        source: 'nominatim'
                    }
                });
            } catch (error) {
                console.error('Nominatim geocoding failed:', error);
                resolve({ success: false, error: "Geocoding request failed", code: "API_ERROR" });
            }
        });
    });

    return result;
}

// Batch geocode for importing multiple locations
export async function geocodeAddresses(addresses: string[]): Promise<Map<string, GeocodeResponse>> {
    const results = new Map<string, GeocodeResponse>();
    // Process sequentially so our internal rate limiter queue respects 1 req/sec properly
    for (const address of addresses) {
        const res = await geocodeAddress(address);
        results.set(address, res);
    }
    return results;
}
