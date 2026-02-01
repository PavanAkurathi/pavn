import { handle } from 'hono/vercel';
// @ts-ignore - Importing from dist which is built before deployment
import { app } from '../dist/index.js';

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
export const OPTIONS = handle(app);
export const HEAD = handle(app);
