import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/cors.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: false,
    clean: true
});
