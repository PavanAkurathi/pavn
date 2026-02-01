import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: false,
    splitting: false,
    sourcemap: false,
    clean: true,
    // Don't bundle dependencies - they're in node_modules
    noExternal: [],
    external: [
        // Workspace packages (pre-built)
        '@repo/auth',
        '@repo/config', 
        '@repo/database',
        '@repo/geofence',
        '@repo/notifications',
        '@repo/shifts-service',
        '@repo/observability',
        // NPM packages
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
        'dotenv'
    ]
});
