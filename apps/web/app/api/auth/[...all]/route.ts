// apps/web/app/api/auth/[...all]/route.ts

import { auth } from "@repo/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const GET = async (request: Request) => {
    console.log("[Auth Route] GET", request.url);
    return auth.handler(request);
}

export const POST = async (request: Request) => {
    console.log("[Auth Route] POST", request.url);
    return auth.handler(request);
}
