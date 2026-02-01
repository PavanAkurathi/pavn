import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: false,
    clean: true,
    // Bundle @repo packages, externalize npm packages
    noExternal: [/@repo\/.*/],
    external: [
        'date-fns',
        'date-fns-tz',
        'drizzle-orm',
        'drizzle-orm/*',
        'hono',
        'hono/*',
        'nanoid',
        'zod',
        '@neondatabase/serverless',
        'dotenv',
        'better-auth',
        'better-auth/*',
        '@better-auth/*',
        'twilio',
        'stripe',
        'resend',
        'react',
        'expo-server-sdk',
        '@sentry/node',
        'google-libphonenumber',
        'crypto'
    ]
});
