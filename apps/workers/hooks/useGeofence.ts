import { useState } from 'react';
import { LocationService } from '../services/location';
import { api } from '../lib/api';

export function useGeofence() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function clockIn(shiftId: string) {
        setLoading(true);
        setError(null);
        try {
            const location = await LocationService.getCurrentLocation();
            if (!location) {
                throw new Error("Location permission denied or unavailable");
            }

            const data = await api.geofence.clockIn({
                shiftId,
                latitude: String(location.coords.latitude),
                longitude: String(location.coords.longitude),
                accuracyMeters: location.coords.accuracy || undefined
            });

            return data;
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }

    async function clockOut(shiftId: string) {
        setLoading(true);
        setError(null);
        try {
            const location = await LocationService.getCurrentLocation();
            if (!location) {
                throw new Error("Location permission denied or unavailable");
            }

            const data = await api.geofence.clockOut({
                shiftId,
                latitude: String(location.coords.latitude),
                longitude: String(location.coords.longitude),
                accuracyMeters: location.coords.accuracy || undefined
            });

            return data;
        } catch (err: any) {
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
