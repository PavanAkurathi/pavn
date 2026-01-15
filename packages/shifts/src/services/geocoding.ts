
import { z } from "zod";

const GeocodeResultSchema = z.object({
    latitude: z.number(),
    longitude: z.number(),
    formattedAddress: z.string(),
    confidence: z.enum(["high", "medium", "low"]),
    source: z.enum(["google", "nominatim"]),
});

export type GeocodeResult = z.infer<typeof GeocodeResultSchema>;

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
    const provider = process.env.GEOCODING_PROVIDER || 'nominatim';

    if (provider === 'google') {
        return geocodeWithGoogle(address);
    } else {
        return geocodeWithNominatim(address);
    }
}

async function geocodeWithNominatim(address: string): Promise<GeocodeResult | null> {
    try {
        if (typeof address !== 'string' || address.trim().length < 5) return null;

        const encoded = encodeURIComponent(address);
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`,
            {
                headers: {
                    'User-Agent': 'WorkersHive/1.0'
                }
            }
        );

        const results = await response.json() as any[];

        if (!results || !Array.isArray(results) || results.length === 0) {
            return null;
        }

        const result = results[0];

        return {
            latitude: parseFloat(result.lat),
            longitude: parseFloat(result.lon),
            formattedAddress: result.display_name,
            confidence: result.importance > 0.5 ? 'high' : 'medium',
            source: 'nominatim'
        };
    } catch (error) {
        console.error('Nominatim geocoding failed:', error);
        return null;
    }
}

async function geocodeWithGoogle(address: string): Promise<GeocodeResult | null> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        console.warn('Google Maps API key not configured');
        return null;
    }

    try {
        const encoded = encodeURIComponent(address);
        const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${apiKey}`
        );

        const data = await response.json() as { status: string; results: any[]; error_message?: string };

        if (data.status !== 'OK' || !data.results?.[0]) {
            return null;
        }

        const result = data.results[0];
        const { lat, lng } = result.geometry.location;

        const confidence =
            result.geometry.location_type === 'ROOFTOP' ? 'high' :
                result.geometry.location_type === 'RANGE_INTERPOLATED' ? 'medium' : 'low';

        return {
            latitude: lat,
            longitude: lng,
            formattedAddress: result.formatted_address,
            confidence,
            source: 'google'
        };
    } catch (error) {
        console.error('Google geocoding failed:', error);
        return null;
    }
}
