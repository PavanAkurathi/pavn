import Constants from "expo-constants";

const getBaseUrl = (port: number) => {
    // Allow overriding via Expo config
    const configuredUrl = Constants.expoConfig?.extra?.apiUrl;
    // If configuredUrl is provided (e.g. 'https://api.production.com'), we might append service paths
    // OR if it's just a host, we append port.
    // For now, assuming explicit dev setup or full URL override.
    // If override is provided, we assume it points to a gateway or we need multiple overrides.
    // MVP: Host replacement.

    const host = Constants.expoConfig?.hostUri?.split(':')[0] || 'localhost';

    // Android Emulator special case
    const isAndroidEmulator = Constants.platform?.android; // simplistic check, or use predefined env
    // Actually, '10.0.2.2' is for Android Emulator to reach host localhost.
    // If using Expo Go, using the IP of the machine is safer. 
    // Constants.expoConfig.hostUri usually contains the IP.

    // If we have a full URL in extra, use it?
    if (Constants.expoConfig?.extra?.apiUrl) return Constants.expoConfig.extra.apiUrl;

    // Development Fallback
    // If running in Expo Go, hostUri is available.
    if (Constants.expoConfig?.hostUri) {
        const ip = Constants.expoConfig.hostUri.split(':')[0];
        return `http://${ip}:${port}`;
    }

    return `http://localhost:${port}`;
};

export const CONFIG = {
    SHIFTS_API_URL: getBaseUrl(4005),
    GEOFENCE_API_URL: getBaseUrl(4006),
    // Add other services if needed
};
