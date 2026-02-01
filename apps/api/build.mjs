#!/usr/bin/env node
/**
Build script for Vercel deployment
Bundles all @repo/* packages and dependencies into a single file
 */

import * as esbuild from 'esbuild';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = join(__dirname, '../..');

console.log('🔧 Building API for Vercel...');
console.log('📁 Current dir:', __dirname);

const distDir = join(__dirname, 'dist');
if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
}

const aliases = {
    '@repo/auth': join(monorepoRoot, 'packages/auth/src/index.ts'),
    '@repo/database': join(monorepoRoot, 'packages/database/src/index.ts'),
    '@repo/database/schema': join(monorepoRoot, 'packages/database/src/schema.ts'),
    '@repo/config': join(monorepoRoot, 'packages/config/src/index.ts'),
    '@repo/config/cors': join(monorepoRoot, 'packages/config/src/cors.ts'),
    '@repo/geofence': join(monorepoRoot, 'packages/geofence/src/index.ts'),
    '@repo/shifts-service': join(monorepoRoot, 'packages/shifts/src/index.ts'),
    '@repo/observability': join(monorepoRoot, 'packages/observability/src/index.ts'),
    '@repo/notifications': join(monorepoRoot, 'packages/notifications/src/index.ts'),
    '@repo/utils': join(monorepoRoot, 'packages/utils/src/index.ts'),
    '@repo/email': join(monorepoRoot, 'packages/email/src/index.ts'),
};

console.log('📦 Bundling workspace packages...');

async function build() {
    try {
        const result = await esbuild.build({
            entryPoints: [join(__dirname, 'src/index.ts')],
            bundle: true,
            platform: 'node',
            target: 'node20',
            format: 'esm',
            outfile: join(__dirname, 'dist/index.js'),
            sourcemap: true,
            minify: true,
            packages: 'bundle',

            // Only keep Node.js built-ins and native modules as external
            external: [
                // Only true Node.js built-ins
                'node:*',
                // Native modules that can't be bundled
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