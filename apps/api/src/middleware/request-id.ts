import { nanoid } from "nanoid";
import type { Context, Next } from "hono";
import type { AppContext } from "../index.js";

export const requestId = () => async (c: Context<AppContext>, next: Next) => {
    const existingId = c.req.header("x-request-id");
    const id = existingId || nanoid();
    c.set("requestId", id);
    c.header("X-Request-ID", id);
    await next();
};
