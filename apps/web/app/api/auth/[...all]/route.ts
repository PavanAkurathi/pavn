// apps/web/app/api/auth/[...all]/route.ts

import { auth } from "@repo/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const GET = async (request: Request) => {
    return auth.handler(request);
}

export const POST = async (request: Request) => {
    return auth.handler(request);
}
