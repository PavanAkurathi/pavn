export const getAllowedOrigins = (): string[] => {
    const origins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    const expoScheme = process.env.EXPO_SCHEME || 'workershive';

    return [
        ...origins,
        `${expoScheme}://`,
        'http://localhost:3000',
        'http://localhost:8081', // Expo Web
        'http://localhost:19000', // Expo Go (Legacy)
        'http://localhost:19006', // Expo Web (Legacy)
    ].filter(Boolean);
};

export const corsConfig = {
    origin: getAllowedOrigins(),
    allowHeaders: ["x-org-id", "Content-Type", "Authorization", "sentry-trace", "baggage"],
    allowMethods: ["POST", "GET", "OPTIONS", "PUT", "DELETE", "PATCH"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
};

