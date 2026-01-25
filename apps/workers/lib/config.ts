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
    // Prioritize environment variables (set in .env or EAS Build)
    SHIFTS_API_URL: process.env.EXPO_PUBLIC_SHIFTS_API_URL || getLocalUrl(4005),
    GEOFENCE_API_URL: process.env.EXPO_PUBLIC_GEOFENCE_API_URL || getLocalUrl(4006),
    API_URL: process.env.EXPO_PUBLIC_API_URL || getLocalUrl(4006),
};
