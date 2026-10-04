export const LOCATIONS = {
    ALL: 'all',
};

export function getApiBaseUrl() {
    const explicit = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_SHIFTS_API_URL;
    if (explicit) {
        return explicit;
    }

    if (process.env.NODE_ENV === "production") {
        throw new Error("[WEB ENV] Missing NEXT_PUBLIC_API_URL or NEXT_PUBLIC_SHIFTS_API_URL.");
    }

    return "http://localhost:4005";
}
