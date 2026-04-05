const LOCAL_WEB_URL = "http://localhost:3000";
const LOCAL_EXPO_WEB_URL = "http://localhost:8081";
const DEFAULT_PRODUCTION_WEB_URL = "https://workershive.com";

export const isAuthProd = process.env.NODE_ENV === "production";

function normalizeUrl(value?: string): string | undefined {
    if (!value) {
        return undefined;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return undefined;
    }

    return trimmed.replace(/\/+$/, "");
}

function normalizeValue(value?: string): string | undefined {
    if (!value) {
        return undefined;
    }

    const trimmed = value.trim();
    return trimmed || undefined;
}

function asOrigin(value?: string): string | undefined {
    const normalized = normalizeUrl(value);
    if (!normalized) {
        return undefined;
    }

    try {
        return new URL(normalized).origin;
    } catch {
        return undefined;
    }
}

function warnCompatFallback(message: string): void {
    console.warn(message);
}

export function requireAuthEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`[AUTH FATAL] Missing required env var: ${key}`);
    }
    return value;
}

export function getBetterAuthServerBaseUrl(): string {
    const explicit = normalizeUrl(process.env.BETTER_AUTH_URL);
    if (explicit) {
        return explicit;
    }

    if (isAuthProd) {
        throw new Error("[AUTH FATAL] Missing BETTER_AUTH_URL for Better Auth server base URL.");
    }

    const compat = normalizeUrl(process.env.NEXT_PUBLIC_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL);
    if (compat) {
        warnCompatFallback("[AUTH] BETTER_AUTH_URL is missing; using NEXT_PUBLIC_AUTH_URL/NEXT_PUBLIC_APP_URL in development.");
        return compat;
    }

    return LOCAL_WEB_URL;
}

export function getWebAuthClientBaseUrl(): string {
    const explicitAuthUrl = normalizeUrl(process.env.NEXT_PUBLIC_AUTH_URL);
    if (explicitAuthUrl) {
        return explicitAuthUrl;
    }

    const appUrl = normalizeUrl(process.env.NEXT_PUBLIC_APP_URL);
    if (appUrl) {
        return appUrl;
    }

    const runtimeOrigin = (globalThis as { location?: { origin?: string } }).location?.origin;
    if (runtimeOrigin) {
        return normalizeUrl(runtimeOrigin) ?? runtimeOrigin;
    }

    const vercelUrl = normalizeUrl(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
    if (vercelUrl) {
        return vercelUrl;
    }

    if (isAuthProd) {
        warnCompatFallback("[AUTH] Missing NEXT_PUBLIC_AUTH_URL/NEXT_PUBLIC_APP_URL; falling back to production site URL for Better Auth client base URL.");
        return DEFAULT_PRODUCTION_WEB_URL;
    }

    return LOCAL_WEB_URL;
}

function buildAllowedOriginsFromEnv(): string[] {
    const fromEnv = process.env.ALLOWED_ORIGINS ?? "";
    if (!fromEnv.trim()) {
        return [];
    }

    return fromEnv
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
        .map((origin) => (origin.startsWith("http") ? origin : `https://${origin}`));
}

export function buildTrustedOrigins(): string[] {
    const origins = new Set<string>([
        LOCAL_WEB_URL,
        "http://127.0.0.1:3000",
        LOCAL_EXPO_WEB_URL,
        "exp://",
        "exp://**",
        "myapp://",
        "gig-workers://",
    ]);

    for (const candidate of [
        getBetterAuthServerBaseUrl(),
        process.env.NEXT_PUBLIC_APP_URL,
        process.env.NEXT_PUBLIC_AUTH_URL,
        process.env.NEXT_PUBLIC_API_URL,
        ...(buildAllowedOriginsFromEnv()),
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    ]) {
        const origin = asOrigin(candidate);
        if (origin) {
            origins.add(origin);
        }
    }

    return [...origins];
}

export type InfraConnectionOptions = {
    apiUrl?: string;
    kvUrl?: string;
    apiKey?: string;
};

export function isBetterAuthInfraEnabled(): boolean {
    return Boolean(normalizeValue(process.env.BETTER_AUTH_API_KEY));
}

export function getBetterAuthInfraConnection(): InfraConnectionOptions | null {
    const apiKey = normalizeValue(process.env.BETTER_AUTH_API_KEY);
    if (!apiKey) {
        return null;
    }

    return {
        apiKey,
        apiUrl: normalizeUrl(process.env.BETTER_AUTH_API_URL),
        kvUrl: normalizeUrl(process.env.BETTER_AUTH_KV_URL),
    };
}
