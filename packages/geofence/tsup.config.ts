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
        '@repo/config',
        '@repo/database',
        '@repo/notifications',
        '@repo/observability',
        'drizzle-orm',
        'drizzle-orm/*',
        'hono',
        'hono/*',
        'nanoid',
        'zod'
    ]
});
