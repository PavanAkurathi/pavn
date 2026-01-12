// packages/geofence/src/utils/distance.ts

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * @returns Distance in meters
 */
export function calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const R = 6371000; // Earth's radius in meters

    const toRad = (deg: number) => deg * (Math.PI / 180);

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c); // Distance in meters, rounded
}

/**
 * Check if a point is within a geofence radius
 */
export function isWithinGeofence(
    workerLat: number,
    workerLng: number,
    venueLat: number,
    venueLng: number,
    radiusMeters: number
): boolean {
    const distance = calculateDistance(workerLat, workerLng, venueLat, venueLng);
    return distance <= radiusMeters;
}

/**
 * Parse coordinate string to number with validation
 */
export function parseCoordinate(coord: string | null | undefined): number | null {
    if (!coord) return null;
    const parsed = parseFloat(coord);
    if (isNaN(parsed)) return null;
    return parsed;
}

/**
 * Validate coordinate ranges
 */
export function isValidCoordinates(lat: number, lng: number): boolean {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}
