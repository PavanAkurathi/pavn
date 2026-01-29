import Constants from "expo-constants";

const getLocalUrl = (port: number) => {
    // Development Fallback
    // If running in Expo Go, hostUri is available.
    if (Constants.expoConfig?.hostUri) {
        const ip = Constants.expoConfig.hostUri.split(':')[0];
        return `http://${ip}:${port}`;
    }
    return `http://localhost:${port}`;
};

export const CONFIG = {
    // All services now run on a single unified API gateway at port 4005
    // In production, set EXPO_PUBLIC_API_URL to https://shift-serf.up.railway.app
    AUTH_API_URL: process.env.EXPO_PUBLIC_AUTH_API_URL || getLocalUrl(4005),
    SHIFTS_API_URL: process.env.EXPO_PUBLIC_SHIFTS_API_URL || getLocalUrl(4005),
    GEOFENCE_API_URL: process.env.EXPO_PUBLIC_GEOFENCE_API_URL || getLocalUrl(4005),
    API_URL: process.env.EXPO_PUBLIC_API_URL || getLocalUrl(4005),
};
