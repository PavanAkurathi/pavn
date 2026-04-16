import { z } from "@hono/zod-openapi";

export const OpenApiLooseObjectSchema = z
    .any()
    .openapi({ type: "object" });

export const OpenApiLooseArraySchema = z
    .array(OpenApiLooseObjectSchema)
    .openapi({ type: "array", items: { type: "object" } });

export const OpenApiLooseDevicesSchema = z
    .object({
        devices: OpenApiLooseArraySchema,
    })
    .openapi("DevicesResponse");
