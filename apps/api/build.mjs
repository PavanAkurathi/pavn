#!/usr/bin/env node
/**
 * Build script for Vercel deployment
 * Bundles all workspace packages into a single JS file
 * 
 * This works even when deployed as a standalone directory
 * because it bundles everything at build time.
 */

import * as esbuild from 'esbuild';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Detect if we're in monorepo or standalone deployment
const monorepoRoot = join(__dirname, '../..');
const isMonorepo = existsSync(join(monorepoRoot, 'packages'));

console.log(`🔧 Build mode: ${isMonorepo ? 'monorepo' : 'standalone'}`);
console.log(`📁 Current dir: ${__dirname}`);

// Build aliases based on environment
function getAliases() {
    if (!isMonorepo) {
        // Standalone: packages should be in node_modules or we bundle everything
        return {};
    }

    return {
        '@repo/auth': join(monorepoRoot, 'packages/auth/src/index.ts'),
        '@repo/database': join(monorepoRoot, 'packages/database/src/index.ts'),
        '@repo/database/schema': join(monorepoRoot, 'packages/database/src/schema.ts'),
        '@repo/config': join(monorepoRoot, 'packages/config/src/index.ts'),
        '@repo/geofence': join(monorepoRoot, 'packages/geofence/src/index.ts'),
        '@repo/shifts-service': join(monorepoRoot, 'packages/shifts/src/index.ts'),
        '@repo/observability': join(monorepoRoot, 'packages/observability/src/index.ts'),
        '@repo/notifications': join(monorepoRoot, 'packages/notifications/src/index.ts'),
        '@repo/utils': join(monorepoRoot, 'packages/utils/src/index.ts'),
        '@repo/email': join(monorepoRoot, 'packages/email/src/index.ts'),
    };
}

async function build() {
    try {
        const aliases = getAliases();

        console.log('📦 Bundling with aliases:', Object.keys(aliases));

        const result = await esbuild.build({
            entryPoints: [join(__dirname, 'src/index.ts')],
            bundle: true,
            platform: 'node',
            target: 'node20',
            format: 'esm',
            outfile: join(__dirname, 'dist/index.js'),
            sourcemap: false,
            minify: false,

            // Bundle ALL workspace packages into output
            packages: 'bundle',

            // Keep node_modules packages external (they have proper JS exports)
            external: [
                // Hono ecosystem
                'hono',
                'hono/*',
                '@hono/*',

                // Database
                'drizzle-orm',
                'drizzle-orm/*',
                '@neondatabase/serverless',
                'postgres',

                // Auth
                'better-auth',
                'better-auth/*',
                '@better-auth/*',

                // Utilities
                'zod',
                'nanoid',
                'dotenv',

                // Services
                'twilio',
                'stripe',
                'resend',
                '@sentry/node',

                // Node builtins
                'crypto',
                'fs',
                'path',
                'url',
                'http',
                'https',
                'stream',
                'util',
                'events',
                'buffer',
                'querystring',
                'os',
                'child_process',
                'net',
                'tls',
                'dns',
                'assert',
            ],

            alias: aliases,

            resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],

            loader: {
                '.ts': 'ts',
                '.tsx': 'tsx',
            },

            // Better error messages
            logLevel: 'info',
            metafile: true,
        });

        // Log bundle stats
        const outputs = Object.keys(result.metafile?.outputs || {});
        for (const output of outputs) {
            const size = result.metafile?.outputs[output]?.bytes || 0;
            console.log(`📄 ${output}: ${(size / 1024).toFixed(1)} KB`);
        }

        console.log('✅ Build complete: dist/index.js');
    } catch (error) {
        console.error('❌ Build failed:', error);
        process.exit(1);
    }
}

build();
