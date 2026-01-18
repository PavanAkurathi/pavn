import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { CONFIG } from '../lib/config';

const LOCATION_TASK_NAME = 'background-location-task';
// const GEOFENCE_API_URL = "http://localhost:4006"; // Replaced by CONFIG


// Define the background task in the global scope
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
    if (error) {
        console.error("Background Location Task Error:", error);
        return;
    }

    if (data) {
        const { locations } = data;
        if (locations && locations.length > 0) {
            const location = locations[0];
            await sendLocationToBackend(location);
        }
    }
});

async function sendLocationToBackend(location: Location.LocationObject) {
    try {
        const token = await SecureStore.getItemAsync("better-auth.session_token");
        if (!token) return;

        // In a real app, use the user's ID if needed, or just relying on Auth Header
        // The backend `ingest-location` uses headers to identify key/user.
        // But `ingest-location` controller expects standard Bearer token auth.

        await fetch(`${CONFIG.GEOFENCE_API_URL}/location`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                timestamp: new Date(location.timestamp).toISOString(),
                accuracy: location.coords.accuracy,
                speed: location.coords.speed,
                heading: location.coords.heading,
                isBackground: true
            })
        });

    } catch (err) {
        console.error("Failed to send background location:", err);
    }
}

export const LocationService = {
    requestPermissions: async () => {
        const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus !== 'granted') return false;

        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        return bgStatus === 'granted';
    },

    startTracking: async () => {
        const hasPermissions = await LocationService.requestPermissions();
        if (!hasPermissions) {
            console.warn("Location permissions not granted");
            return;
        }

        const isStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (isStarted) return;

        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 60 * 1000, // 1 minute
            distanceInterval: 100, // 100 meters
            foregroundService: {
                notificationTitle: "Pavn Location Service",
                notificationBody: "Tracking your location for shift verification",
            },
            pausesUpdatesAutomatically: false,
        });
        console.log("Background location tracking started");
    },

    stopTracking: async () => {
        const isStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (isStarted) {
            await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
            console.log("Background location tracking stopped");
        }
    },

    getCurrentLocation: async () => {
        const hasPermissions = await LocationService.requestPermissions();
        if (!hasPermissions) return null;
        return await Location.getCurrentPositionAsync({});
    }
};
