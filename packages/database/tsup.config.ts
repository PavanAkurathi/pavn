import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/schema.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: false,
    clean: true,
    external: [
        '@neondatabase/serverless',
        'drizzle-orm',
        'dotenv',
        'nanoid'
    ]
});
