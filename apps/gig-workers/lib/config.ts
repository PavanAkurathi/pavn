import Constants from "expo-constants";
import { optionalPublicEnv, publicEnvWithDevFallback } from "./env";

const getLocalUrl = (port: number) => {
    // Metro tells us the machine it is being served from, which is the same
    // machine running the API. This is what makes a real device work without
    // anyone typing an IP address.
    const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;

    if (hostUri) {
        const ip = hostUri.split(":")[0];
        if (ip) return `http://${ip}:${port}`;
    }

    // There used to be a hardcoded LAN address here. When the network it named
    // stopped existing, a device would sit silently failing every request with
    // nothing on screen to explain why. Say so instead: on a simulator
    // localhost is right, and on a device the only honest answer is that
    // EXPO_PUBLIC_API_URL needs setting.
    console.warn(
        "[CONFIG] Metro did not report a host. Falling back to localhost, which " +
        "only works on a simulator. On a physical device set EXPO_PUBLIC_API_URL " +
        "to your machine's LAN address, e.g. http://192.168.1.20:" + port,
    );
    return `http://localhost:${port}`;
};

const apiUrl = publicEnvWithDevFallback("EXPO_PUBLIC_API_URL", getLocalUrl(4005));

export const CONFIG = {
    API_URL: apiUrl,
    AUTH_API_URL: optionalPublicEnv("EXPO_PUBLIC_AUTH_API_URL") ?? apiUrl,
    SHIFTS_API_URL: optionalPublicEnv("EXPO_PUBLIC_SHIFTS_API_URL") ?? apiUrl,
    GEOFENCE_API_URL: optionalPublicEnv("EXPO_PUBLIC_GEOFENCE_API_URL") ?? apiUrl,
};
