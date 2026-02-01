// Vercel Serverless Function Entry Point
// This imports the pre-bundled app from dist/index.js
import { handle } from 'hono/vercel';
import { app } from '../dist/index.js';

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
export const OPTIONS = handle(app);
export const HEAD = handle(app);
