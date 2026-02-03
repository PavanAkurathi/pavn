export const getAllowedOrigins = (): string[] => {
    const origins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    const expoScheme = process.env.EXPO_SCHEME || 'workershive';

    return [
        ...origins,
        `${expoScheme}://`,
        // Local development
        'http://localhost:3000',
        'http://localhost:8081', // Expo Web
        'http://localhost:19000', // Expo Go (Legacy)
        'http://localhost:19006', // Expo Web (Legacy)
        // Vercel preview deployments
        'https://pavn-api.vercel.app',
        'https://pavn.vercel.app',
    ].filter(Boolean);
};

// Dynamic origin checker for Vercel preview URLs
export const isAllowedOrigin = (origin: string | undefined): boolean => {
    if (!origin) return false;

    const allowedOrigins = getAllowedOrigins();

    // Direct match
    if (allowedOrigins.includes(origin)) return true;

    // Allow all Vercel preview deployments for this project
    if (origin.match(/^https:\/\/pavn(-[a-z0-9]+)?\.vercel\.app$/)) return true;
    if (origin.match(/^https:\/\/pavn-web(-[a-z0-9]+)?\.vercel\.app$/)) return true;

    // Allow pavanworkershives Vercel team URLs
    if (origin.includes('pavanworkershives-projects.vercel.app')) return true;

    return false;
};

export const corsConfig = {
    origin: (origin: string | undefined) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return '*';
        return isAllowedOrigin(origin) ? origin : null;
    },
    allowHeaders: ["x-org-id", "Content-Type", "Authorization", "sentry-trace", "baggage"],
    allowMethods: ["POST", "GET", "OPTIONS", "PUT", "DELETE", "PATCH"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
};
