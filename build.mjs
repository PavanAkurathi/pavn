#!/usr/bin/env node
/**
Build script for Vercel deployment at monorepo root
Bundles all @repo/* packages and dependencies into a single file
 */

import * as esbuild from 'esbuild';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('🔧 Building API for Vercel...');
console.log('📁 Current dir:', __dirname);

const distDir = join(__dirname, 'apps/api/dist');
if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
}

const aliases = {
    '@repo/auth': join(__dirname, 'packages/auth/src/index.ts'),
    '@repo/database': join(__dirname, 'packages/database/src/index.ts'),
    '@repo/database/schema': join(__dirname, 'packages/database/src/schema.ts'),
    '@repo/config': join(__dirname, 'packages/config/src/index.ts'),
    '@repo/config/cors': join(__dirname, 'packages/config/src/cors.ts'),
    '@repo/geofence': join(__dirname, 'packages/geofence/src/index.ts'),
    '@repo/shifts-service': join(__dirname, 'packages/shifts/src/index.ts'),
    '@repo/observability': join(__dirname, 'packages/observability/src/index.ts'),
    '@repo/notifications': join(__dirname, 'packages/notifications/src/index.ts'),
    '@repo/utils': join(__dirname, 'packages/utils/src/index.ts'),
    '@repo/email': join(__dirname, 'packages/email/src/index.ts'),
};

console.log('📦 Bundling workspace packages...');

async function build() {
    try {
        const result = await esbuild.build({
            entryPoints: [join(__dirname, 'apps/api/src/index.ts')],
            bundle: true,
            platform: 'node',
            target: 'node20',
            format: 'esm',
            outfile: join(__dirname, 'apps/api/dist/index.js'),
            sourcemap: true,
            minify: true,
            packages: 'bundle',

            external: [
                'node:*',
                'better-sqlite3',
                'pg-native',
            ],

            alias: aliases,
            resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
            loader: { '.ts': 'ts', '.tsx': 'tsx' },
            logLevel: 'info',
            metafile: true,
        });

        for (const [file, info] of Object.entries(result.metafile?.outputs || {})) {
            console.log(`📄 ${file}: ${(info.bytes / 1024).toFixed(1)} KB`);
        }

        console.log('✅ Build complete!');
    } catch (error) {
        console.error('❌ Build failed:', error);
        process.exit(1);
    }
}

build();