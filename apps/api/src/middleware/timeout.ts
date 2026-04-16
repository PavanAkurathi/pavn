import type { Context, Next } from "hono";
import { AppError } from "@repo/observability";
import type { AppContext } from "../index.js";

export const timeout = (durationMs: number = 30000) => {
    return async (c: Context<AppContext>, next: Next) => {
        let timer: ReturnType<typeof setTimeout> | undefined;

        const timeoutPromise = new Promise((_, reject) => {
            timer = setTimeout(() => {
                reject(new AppError("Request Timeout", "GATEWAY_TIMEOUT", 504));
            }, durationMs);
        });

        try {
            await Promise.race([next(), timeoutPromise]);
        } finally {
            if (timer) clearTimeout(timer);
        }
    };
};
