import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/client.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: false,
    clean: true,
    external: [
        '@repo/database',
        '@repo/email',
        '@repo/utils',
        'better-auth',
        'better-auth/*',
        '@better-auth/*',
        'drizzle-orm',
        'drizzle-orm/*',
        'stripe',
        'twilio',
        'nanoid',
        'dotenv'
    ]
});
