export function requireServerEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`[WEB ENV] Missing required env var: ${key}`);
    }
    return value;
}

export function requireServerEnvInProduction(key: string): string | undefined {
    if (process.env.NODE_ENV === "production") {
        return requireServerEnv(key);
    }

    return process.env[key];
}
