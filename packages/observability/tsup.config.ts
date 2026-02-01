import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: false,
    clean: true,
    external: [
        '@repo/database',
        '@sentry/node',
        'hono',
        'hono/*',
        'nanoid',
        'zod'
    ]
});
