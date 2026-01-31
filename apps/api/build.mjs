#!/usr/bin/env node
/**
 * Build script for Vercel deployment
 * Bundles all workspace packages into a single JS file
 */

import * as esbuild from 'esbuild';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function build() {
    try {
        await esbuild.build({
            entryPoints: [join(__dirname, 'src/index.ts')],
            bundle: true,
            platform: 'node',
            target: 'node20',
            format: 'esm',
            outfile: join(__dirname, 'dist/index.js'),
            sourcemap: false,
            minify: false,
            // Bundle workspace packages (they export .ts files)
            packages: 'bundle',
            // Keep these as external (npm packages with proper JS exports)
            external: [
                'hono',
                'hono/*',
                '@hono/*',
                'drizzle-orm',
                'drizzle-orm/*',
                'better-auth',
                'better-auth/*',
                '@better-auth/*',
                '@neondatabase/serverless',
                'postgres',
                'zod',
                'nanoid',
                'twilio',
                'stripe',
                'dotenv',
                'resend',
                '@sentry/node',
            ],
            // Resolve workspace packages
            alias: {
                '@repo/auth': join(__dirname, '../../packages/auth/src/index.ts'),
                '@repo/database': join(__dirname, '../../packages/database/src/index.ts'),
                '@repo/database/schema': join(__dirname, '../../packages/database/src/schema/index.ts'),
                '@repo/config': join(__dirname, '../../packages/config/src/index.ts'),
                '@repo/geofence': join(__dirname, '../../packages/geofence/src/index.ts'),
                '@repo/shifts-service': join(__dirname, '../../packages/shifts/src/index.ts'),
                '@repo/observability': join(__dirname, '../../packages/observability/src/index.ts'),
                '@repo/notifications': join(__dirname, '../../packages/notifications/src/index.ts'),
                '@repo/utils': join(__dirname, '../../packages/utils/src/index.ts'),
            },
            // Handle .js extensions in imports
            resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
            loader: {
                '.ts': 'ts',
            },
            logLevel: 'info',
        });

        console.log('✅ Build complete: dist/index.js');
    } catch (error) {
        console.error('❌ Build failed:', error);
        process.exit(1);
    }
}

build();
