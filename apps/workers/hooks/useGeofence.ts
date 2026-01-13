import { useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { LocationService } from '../services/location';

const GEOFENCE_API_URL = process.env.EXPO_PUBLIC_GEOFENCE_API_URL || "http://localhost:4006";


export function useGeofence() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function clockIn(assignmentId: string) {
        setLoading(true);
        setError(null);
        try {
            const location = await LocationService.getCurrentLocation();
            if (!location) {
                throw new Error("Location permission denied or unavailable");
            }

            const token = await SecureStore.getItemAsync("better-auth.session_token");

            const response = await fetch(`${GEOFENCE_API_URL}/clock-in`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    assignmentId,
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    timestamp: new Date().toISOString()
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to clock in");
            }

            return data;
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }

    async function clockOut(assignmentId: string) {
        setLoading(true);
        setError(null);
        try {
            const location = await LocationService.getCurrentLocation();
            if (!location) {
                throw new Error("Location permission denied or unavailable");
            }

            const token = await SecureStore.getItemAsync("better-auth.session_token");

            const response = await fetch(`${GEOFENCE_API_URL}/clock-out`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    assignmentId,
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    timestamp: new Date().toISOString()
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to clock out");
            }

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
