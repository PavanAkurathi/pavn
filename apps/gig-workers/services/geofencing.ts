import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, WorkerShift } from '../lib/api';
import { scheduleLocalNotification } from '../utils/notifications';

export const GEOFENCE_TASK_NAME = 'geofence-monitor-task';
const GEOFENCE_LOGS_KEY = 'geofence_logs';
const MAX_GEOFENCE_LOG_ENTRIES = 50;

type GeofenceLogEntry = {
    type: 'ENTER' | 'EXIT';
    regionId: string;
    timestamp: string;
};

async function appendGeofenceLog(entry: GeofenceLogEntry): Promise<void> {
    try {
        const existingValue = await AsyncStorage.getItem(GEOFENCE_LOGS_KEY);
        const existingLogs = existingValue ? JSON.parse(existingValue) : [];
        const nextLogs = Array.isArray(existingLogs) ? existingLogs : [];

        nextLogs.push(entry);
        const retainedLogs = nextLogs.slice(-MAX_GEOFENCE_LOG_ENTRIES);

        await AsyncStorage.setItem(GEOFENCE_LOGS_KEY, JSON.stringify(retainedLogs));
    } catch (error) {
        console.error('[GEOFENCE] Failed to persist geofence log:', error);
    }
}

/**
 * Define the Geofence Task
 */
TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
    if (error) {
        console.error('[GEOFENCE] Task error:', error);
        return;
    }

    if (data) {
        const { eventType, region } = data as { eventType: Location.GeofencingEventType, region: Location.LocationRegion };

        const type = eventType === Location.GeofencingEventType.Enter ? 'ENTER' : 'EXIT';


        try {
            await appendGeofenceLog({
                type,
                regionId: region.identifier || 'unknown-region',
                timestamp: new Date().toISOString()
            });

            if (type === 'ENTER') {
                await scheduleLocalNotification(
                    "You've arrived!",
                    "Open the app to clock in or clock out."
                );
            }
        } catch (e) {
            console.error('[GEOFENCE] Failed to log event:', e);
        }
    }
});

/**
 * Sync Geofences based on upcoming shifts
 */
export async function syncGeofences() {
    try {
        // 1. Fetch upcoming shifts
        const result = await api.worker.getAllShifts('upcoming');
        await registerGeofences(result.shifts);
    } catch (error) {
        console.error('[GEOFENCE] Sync failed:', error);
    }
}

export async function registerGeofences(shifts: WorkerShift[]) {
    const regionsByLocation = new Map<string, Location.LocationRegion>();

    for (const shift of shifts) {
        if (
            shift.location &&
            typeof shift.location.latitude === 'number' &&
            typeof shift.location.longitude === 'number' &&
            !regionsByLocation.has(shift.location.id)
        ) {
            regionsByLocation.set(shift.location.id, {
                identifier: shift.location.id,
                latitude: shift.location.latitude,
                longitude: shift.location.longitude,
                radius: shift.location.geofenceRadius || 100,
                notifyOnEnter: true,
                notifyOnExit: true,
            });
        }
    }

    const regions = Array.from(regionsByLocation.values());

    if (regions.length > 0) {
        // Expo limits to 20 regions
        const limitedRegions = regions.slice(0, 20);

        await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, limitedRegions);

    } else {
        await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);

    }
}
