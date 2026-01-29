import { useState } from 'react';
import { LocationService } from '../services/location';
import { api } from '../lib/api';
import { z } from 'zod';

const ClockRequestSchema = z.object({
    shiftId: z.string().min(1, "Shift ID required"),
    latitude: z.string().regex(/^-?\d+\.?\d*$/, "Invalid latitude"),
    longitude: z.string().regex(/^-?\d+\.?\d*$/, "Invalid longitude"),
    accuracyMeters: z.number().max(200, "GPS signal too weak. Move to an open area.").optional(),
    deviceTimestamp: z.string().datetime("Invalid timestamp"),
});

// Helper to calculate distance between two coordinates in meters
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

export function useGeofence() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function clockIn(shiftId: string, targetLocation?: { latitude?: number; longitude?: number; geofenceRadius?: number }) {
        setLoading(true);
        setError(null);
        try {
            const location = await LocationService.getCurrentLocation();
            if (!location) {
                throw new Error("Location permission denied. Please enable in Settings.");
            }

            // 1. Validate GPS Accuracy (Anti-spoofing / Bad Signal)
            const accuracy = location.coords.accuracy || 0;
            if (accuracy > 200) {
                throw new Error(`GPS signal too weak (${Math.round(accuracy)}m accuracy). Move to an open area and try again.`);
            }

            // 2. Validate Proximity (if target provided)
            if (targetLocation?.latitude && targetLocation?.longitude) {
                const distance = haversineDistance(
                    location.coords.latitude,
                    location.coords.longitude,
                    targetLocation.latitude,
                    targetLocation.longitude
                );

                // Default radius 100m if not specified
                const radius = targetLocation.geofenceRadius || 100;

                if (distance > radius) {
                    // GENERIC ERROR - No distance shown to user to prevent triangulation
                    throw new Error("You must be at the job location to clock in.");
                }
            }

            const request = {
                shiftId,
                latitude: String(location.coords.latitude),
                longitude: String(location.coords.longitude),
                accuracyMeters: accuracy || undefined,
                deviceTimestamp: new Date().toISOString()
            };

            const validation = ClockRequestSchema.safeParse(request);
            if (!validation.success) {
                // Fixed: Access issues instead of errors
                const msg = validation.error.issues[0]?.message || "Invalid request";
                throw new Error(msg);
            }

            const data = await api.geofence.clockIn(request);

            return data;
        } catch (err: any) {
            console.error('[CLOCK_IN] Error:', err);
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }

    async function clockOut(shiftId: string, targetLocation?: { latitude?: number; longitude?: number; geofenceRadius?: number }) {
        setLoading(true);
        setError(null);
        try {
            const location = await LocationService.getCurrentLocation();
            if (!location) {
                throw new Error("Location permission denied. Please enable in Settings.");
            }

            const accuracy = location.coords.accuracy || 0;

            // Note: We might want slightly looser accuracy for clock-out, but keeping consistent for now
            if (accuracy > 200) {
                // Warn but maybe don't block? For now, block to ensure data quality.
                throw new Error(`GPS signal too weak (${Math.round(accuracy)}m accuracy). Move to an open area and try again.`);
            }

            // 2. Validate Proximity (if target provided)
            if (targetLocation?.latitude && targetLocation?.longitude) {
                const distance = haversineDistance(
                    location.coords.latitude,
                    location.coords.longitude,
                    targetLocation.latitude,
                    targetLocation.longitude
                );

                const radius = targetLocation.geofenceRadius || 100;

                if (distance > radius) {
                    throw new Error("You must be at the job location to clock out.");
                }
            }

            const request = {
                shiftId,
                latitude: String(location.coords.latitude),
                longitude: String(location.coords.longitude),
                accuracyMeters: accuracy || undefined,
                deviceTimestamp: new Date().toISOString()
            };

            const validation = ClockRequestSchema.safeParse(request);
            if (!validation.success) {
                // Fixed: Access issues instead of errors
                const msg = validation.error.issues[0]?.message || "Invalid request";
                throw new Error(msg);
            }

            const data = await api.geofence.clockOut(request);

            return data;
        } catch (err: any) {
            console.error('[CLOCK_OUT] Error:', err);
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }

    return {
        clockIn,
        clockOut,
        loading,
        error
    };
}
