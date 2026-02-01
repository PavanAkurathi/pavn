import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/client.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: false,
    clean: true,
    // Bundle @repo packages, externalize npm packages
    noExternal: [/@repo\/.*/],
    external: [
        'better-auth',
        'better-auth/*',
        '@better-auth/*',
        'drizzle-orm',
        'drizzle-orm/*',
        'stripe',
        'twilio',
        'nanoid',
        'dotenv',
        'resend',
        'react',
        '@neondatabase/serverless',
        'google-libphonenumber'
    ]
});
