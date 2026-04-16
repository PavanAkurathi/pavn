import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { AppError, logError } from "@repo/observability";
import type { AppContext } from "../index.js";

export const errorHandler = async (err: Error, c: Context<AppContext>) => {
    const requestId = c.get("requestId");

    logError(err, {
        requestId,
        path: c.req.path,
        method: c.req.method,
        query: c.req.query(),
    });

    if (err instanceof AppError) {
        return c.json(
            {
                success: false,
                error: err.message,
                code: err.code,
                details: err.details,
                requestId,
            },
            err.statusCode as any,
        );
    }

    if (err instanceof ZodError) {
        return c.json(
            {
                success: false,
                error: "Validation Failed",
                code: "VALIDATION_ERROR",
                details: (err as any).errors,
                requestId,
            },
            400,
        );
    }

    if (err instanceof HTTPException) {
        return c.json(
            {
                success: false,
                error: err.message,
                code: "HTTP_ERROR",
                requestId,
            },
            err.status as any,
        );
    }

    return c.json(
        {
            success: false,
            error: "Internal Server Error",
            code: "INTERNAL_SERVER_ERROR",
            requestId,
        },
        500,
    );
};
