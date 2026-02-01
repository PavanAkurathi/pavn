import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: false,
    splitting: false,
    sourcemap: false,
    clean: true,
    // Bundle @repo packages, externalize npm packages
    noExternal: [/@repo\/.*/],
    external: [
        'hono',
        'hono/*',
        '@hono/*',
        'drizzle-orm',
        'drizzle-orm/*',
        '@neondatabase/serverless',
        'better-auth',
        'better-auth/*',
        '@better-auth/*',
        'zod',
        'nanoid',
        'dotenv',
        'twilio',
        'stripe',
        'resend',
        'react',
        'expo-server-sdk',
        '@sentry/node',
        'date-fns',
        'date-fns-tz',
        'google-libphonenumber',
        'crypto'
    ]
});
