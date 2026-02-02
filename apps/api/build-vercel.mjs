#!/usr/bin/env node
/**
 * Vercel Build Script
 * 
 * This script handles the complexity of building a monorepo app on Vercel.
 * It bundles all @repo/* workspace packages into a single JS file.
 */

import * as esbuild from 'esbuild';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Detect monorepo structure
const monorepoRoot = join(__dirname, '../..');
const packagesDir = join(monorepoRoot, 'packages');
const isMonorepo = existsSync(packagesDir);

console.log('====================================');
console.log('🚀 WorkersHive API - Vercel Build');
console.log('====================================');
console.log(`📁 Build dir: ${__dirname}`);
console.log(`📦 Monorepo mode: ${isMonorepo}`);
console.log(`📦 Packages dir: ${packagesDir}`);
console.log(`📦 Packages exist: ${existsSync(packagesDir)}`);

// Ensure dist directory exists
const distDir = join(__dirname, 'dist');
if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
}

async function build() {
    // Build aliases to resolve workspace packages to their TypeScript source
    const aliases = {};

    if (isMonorepo) {
        const workspacePackages = [
            'auth',
            'database',
            'config',
            'geofence',
            'shifts',
            'observability',
            'notifications',
            'utils',
            'email',
        ];

        for (const pkg of workspacePackages) {
            const pkgPath = join(packagesDir, pkg, 'src/index.ts');
            if (existsSync(pkgPath)) {
                // Map both @repo/pkg and @repo/pkg-service patterns
                aliases[`@repo/${pkg}`] = pkgPath;
                aliases[`@repo/${pkg}-service`] = pkgPath;
                console.log(`  ✓ @repo/${pkg} → ${pkgPath}`);
            } else {
                console.log(`  ✗ @repo/${pkg} not found at ${pkgPath}`);
            }
        }

        // Special case: database/schema subpath
        const schemaPath = join(packagesDir, 'database/src/schema.ts');
        if (existsSync(schemaPath)) {
            aliases['@repo/database/schema'] = schemaPath;
            console.log(`  ✓ @repo/database/schema → ${schemaPath}`);
        }
    }

    console.log('\n📦 Building bundle...\n');

    try {
        const result = await esbuild.build({
            entryPoints: [join(__dirname, 'src/index.ts')],
            bundle: true,
            platform: 'node',
            target: 'node20',
            format: 'esm',
            outfile: join(__dirname, 'dist/index.js'),
            sourcemap: false,
            minify: false,
            treeShaking: true,

            // Bundle workspace packages (they export .ts files)
            packages: 'bundle',

            // External: npm packages that have proper ESM exports
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

                // External services
                'twilio',
                'stripe',
                'resend',
                '@sentry/node',
                'expo-server-sdk',

                // Utils
                'date-fns',
                'date-fns-tz',
                'google-libphonenumber',
            ],

            alias: aliases,

            resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],

            loader: {
                '.ts': 'ts',
                '.tsx': 'tsx',
            },

            logLevel: 'warning',
            metafile: true,
        });

        // Output stats
        console.log('\n📊 Build Output:');
        for (const [file, info] of Object.entries(result.metafile?.outputs || {})) {
            const sizeKB = (info.bytes / 1024).toFixed(1);
            console.log(`   ${file}: ${sizeKB} KB`);
        }

        console.log('\n✅ Build successful!');
        console.log(`   Output: dist/index.js`);

    } catch (error) {
        console.error('\n❌ Build failed:');
        console.error(error);
        process.exit(1);
    }
}

build();
