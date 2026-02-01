// Vercel Serverless Function Entry Point
// The API is built to dist/index.js by tsup
import { handle } from 'hono/vercel';
import { app } from '../dist/index.js';

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
export const OPTIONS = handle(app);
export const HEAD = handle(app);
