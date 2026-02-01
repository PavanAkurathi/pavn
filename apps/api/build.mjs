#!/usr/bin/env node
/**
 * Build script for Vercel deployment
 * Uses esbuild with proper CJS output to avoid ESM circular dependency issues
 */

import * as esbuild from 'esbuild';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = join(__dirname, '../..');
const isMonorepo = existsSync(join(monorepoRoot, 'packages'));

console.log(`🔧 Build mode: ${isMonorepo ? 'monorepo' : 'standalone'}`);
console.log(`📁 Current dir: ${__dirname}`);

// Ensure dist exists
const distDir = join(__dirname, 'dist');
if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
}

// Build aliases for workspace packages
function getAliases() {
    if (!isMonorepo) return {};
    
    const aliases = {};
    const packages = [
        ['@repo/auth', 'auth/src/index.ts'],
        ['@repo/database', 'database/src/index.ts'],
        ['@repo/database/schema', 'database/src/schema.ts'],
        ['@repo/config', 'config/src/index.ts'],
        ['@repo/geofence', 'geofence/src/index.ts'],
        ['@repo/shifts-service', 'shifts/src/index.ts'],
        ['@repo/observability', 'observability/src/index.ts'],
        ['@repo/notifications', 'notifications/src/index.ts'],
        ['@repo/utils', 'utils/src/index.ts'],
        ['@repo/email', 'email/src/index.ts'],
    ];
    
    for (const [alias, path] of packages) {
        const fullPath = join(monorepoRoot, 'packages', path);
        if (existsSync(fullPath)) {
            aliases[alias] = fullPath;
        }
    }
    
    console.log('📦 Bundling with aliases:', Object.keys(aliases));
    return aliases;
}

async function build() {
    try {
        const result = await esbuild.build({
            entryPoints: [join(__dirname, 'src/index.ts')],
            bundle: true,
            platform: 'node',
            target: 'node20',
            // Use CJS format to avoid ESM circular dependency issues
            format: 'cjs',
            outfile: join(__dirname, 'dist/index.cjs'),
            sourcemap: false,
            minify: false,
            
            // Bundle workspace packages
            packages: 'bundle',
            
            // Keep npm packages external
            external: [
                // Hono
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
                // Utils
                'zod',
                'nanoid',
                'dotenv',
                // Services
                'twilio',
                'stripe',
                'resend',
                '@sentry/node',
            ],
            
            alias: getAliases(),
            resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
            loader: { '.ts': 'ts', '.tsx': 'tsx' },
            logLevel: 'info',
            metafile: true,
        });

        // Now create ESM wrapper that imports the CJS bundle
        const wrapperContent = `
// ESM wrapper for Vercel serverless functions
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const bundle = require('./index.cjs');
export const app = bundle.app;
export default bundle.default;
`;
        
        const fs = await import('fs/promises');
        await fs.writeFile(join(__dirname, 'dist/index.js'), wrapperContent.trim());

        // Log stats
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
