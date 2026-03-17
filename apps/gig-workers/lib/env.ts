const isProd = process.env.NODE_ENV === "production";

export function requirePublicEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`[WORKERS ENV] Missing required env var: ${key}`);
    }
    return value;
}

export function publicEnvWithDevFallback(key: string, fallback: string): string {
    if (isProd) {
        return requirePublicEnv(key);
    }

    return process.env[key] || fallback;
}

export function optionalPublicEnv(key: string): string | undefined {
    return process.env[key] || undefined;
}

export { isProd as isWorkersProd };
