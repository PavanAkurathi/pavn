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
        '@sentry/node',
        'hono',
        'nanoid',
        'zod',
        'drizzle-orm',
        '@neondatabase/serverless',
        'dotenv'
    ]
});
