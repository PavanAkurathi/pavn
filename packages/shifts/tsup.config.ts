import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: false,
    clean: true,
    external: [
        '@repo/auth',
        '@repo/database',
        '@repo/config',
        '@repo/geofence',
        '@repo/notifications',
        '@repo/observability',
        'date-fns',
        'date-fns-tz',
        'drizzle-orm',
        'drizzle-orm/*',
        'hono',
        'hono/*',
        'nanoid',
        'zod'
    ]
});
