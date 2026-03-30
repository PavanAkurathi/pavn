import { handle } from 'hono/vercel';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { app } = require('../dist/index.cjs');

export const config = {
    runtime: 'nodejs',
};

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
export const OPTIONS = handle(app);
export const HEAD = handle(app);
