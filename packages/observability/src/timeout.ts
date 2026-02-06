import { Context, Next } from "hono";
import { AppError } from "./errors";

export const timeout = (durationMs: number = 30000) => {
    return async (c: Context, next: Next) => {
        let timer: ReturnType<typeof setTimeout> | undefined;

        const timeoutPromise = new Promise((_, reject) => {
            timer = setTimeout(() => {
                reject(new AppError("Request Timeout", "GATEWAY_TIMEOUT", 504));
            }, durationMs);
        });

        try {
            await Promise.race([
                next(),
                timeoutPromise
            ]);
        } finally {
            if (timer) clearTimeout(timer);
        }
    };
};
