import Constants from "expo-constants";
import { optionalPublicEnv, publicEnvWithDevFallback } from "./env";

const getLocalUrl = (port: number) => {
    // Development Fallback
    // If running in Expo Go, hostUri is available.
    if (Constants.expoConfig?.hostUri) {
        const ip = Constants.expoConfig.hostUri.split(':')[0];
        return `http://${ip}:${port}`;
    }
    return `http://10.0.0.38:${port}`;
};

const apiUrl = publicEnvWithDevFallback("EXPO_PUBLIC_API_URL", getLocalUrl(4005));

export const CONFIG = {
    API_URL: apiUrl,
    AUTH_API_URL: optionalPublicEnv("EXPO_PUBLIC_AUTH_API_URL") ?? apiUrl,
    SHIFTS_API_URL: optionalPublicEnv("EXPO_PUBLIC_SHIFTS_API_URL") ?? apiUrl,
    GEOFENCE_API_URL: optionalPublicEnv("EXPO_PUBLIC_GEOFENCE_API_URL") ?? apiUrl,
};
