// packages/api/src/openapi.ts

import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

/**
 * WorkersHive API OpenAPI Specification
 * 
 * This file defines the OpenAPI schema for the WorkersHive API.
 * It's used to generate Swagger UI documentation.
 */

// Common schemas
export const ErrorSchema = z.object({
    error: z.string().openapi({ example: "Unauthorized" }),
    code: z.string().optional().openapi({ example: "RATE_LIMITED" }),
    details: z.any().optional(),
});

export const SuccessSchema = z.object({
    success: z.boolean().openapi({ example: true }),
});

// Shift schemas
export const ShiftSchema = z.object({
    id: z.string().openapi({ example: "shift_abc123" }),
    title: z.string().openapi({ example: "Event Security" }),
    description: z.string().optional(),
    startTime: z.string().datetime().openapi({ example: "2026-01-30T09:00:00Z" }),
    endTime: z.string().datetime().openapi({ example: "2026-01-30T17:00:00Z" }),
    status: z.enum(["published", "assigned", "in-progress", "completed", "approved", "cancelled"]),
    price: z.number().openapi({ example: 2000, description: "Price in cents" }),
    capacityTotal: z.number().openapi({ example: 3 }),
    locationId: z.string().optional(),
    organizationId: z.string(),
});

export const WorkerShiftSchema = z.object({
    id: z.string(),
    title: z.string(),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    status: z.string(),
    location: z.object({
        id: z.string(),
        name: z.string(),
        address: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        geofenceRadius: z.number().optional(),
    }),
    organization: z.object({
        id: z.string(),
        name: z.string(),
    }),
    pay: z.object({
        estimatedPay: z.number().optional(),
        hourlyRate: z.number(),
    }),
    timesheet: z.object({
        clockIn: z.string().datetime().optional(),
        clockOut: z.string().datetime().optional(),
    }),
});

// Clock In/Out schemas
export const ClockInRequestSchema = z.object({
    shiftId: z.string().openapi({ example: "shift_abc123" }),
    latitude: z.string().openapi({ example: "42.3601" }),
    longitude: z.string().openapi({ example: "-71.0589" }),
    accuracyMeters: z.number().optional().openapi({ example: 10 }),
    deviceTimestamp: z.string().datetime().openapi({ example: "2026-01-30T09:00:00Z" }),
});

export const ClockInResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
        clockInTime: z.string().datetime(),
        actualTime: z.string().datetime(),
        scheduledTime: z.string().datetime(),
        wasEarly: z.boolean(),
        wasLate: z.boolean(),
        minutesDifference: z.number(),
    }),
});

// Adjustment schemas
export const AdjustmentRequestSchema = z.object({
    shiftAssignmentId: z.string(),
    reason: z.string().openapi({ example: "Forgot to clock out" }),
    requestedClockIn: z.string().datetime().optional(),
    requestedClockOut: z.string().datetime().optional(),
    requestedBreakMinutes: z.number().optional(),
});

// Auth header schema
export const AuthHeaderSchema = z.object({
    Authorization: z.string().openapi({ example: "Bearer session_token_here" }),
    "x-org-id": z.string().openapi({ example: "org_abc123" }),
});

/**
 * OpenAPI configuration for WorkersHive API
 */
export const openAPIConfig = {
    openapi: "3.0.0",
    info: {
        title: "WorkersHive API",
        version: "1.0.0",
        description: `
# WorkersHive API

Hospitality staffing platform API for managing shifts, workers, and timesheets.

## Authentication

All endpoints (except /health) require:
- \`Authorization: Bearer <session_token>\` header
- \`x-org-id: <organization_id>\` header

## Roles

- **admin**: Full access including payment method CRUD
- **manager**: Full access except payment method CRUD
- **member**: Worker-level access (own shifts, clock in/out)

## Rate Limits

- Clock actions: 5/minute
- Schedule publish: 10/minute
- General API: 100/minute
        `,
        contact: {
            name: "WorkersHive Support",
            email: "support@workershive.com",
        },
    },
    servers: [
        {
            url: "https://shift-serf.up.railway.app",
            description: "Production",
        },
        {
            url: "http://localhost:4005",
            description: "Development",
        },
    ],
    tags: [
        { name: "Health", description: "Health check endpoints" },
        { name: "Auth", description: "Authentication endpoints" },
        { name: "Shifts", description: "Shift management" },
        { name: "Worker", description: "Worker-specific endpoints" },
        { name: "Geofence", description: "Clock in/out with location verification" },
        { name: "Timesheets", description: "Timesheet management and export" },
        { name: "Adjustments", description: "Time correction requests" },
        { name: "Billing", description: "Payment and subscription management (Admin only)" },
    ],
};

/**
 * Create the OpenAPI Hono app with Swagger UI
 */
export function createOpenAPIApp() {
    const app = new OpenAPIHono();

    // Health check route
    const healthRoute = createRoute({
        method: "get",
        path: "/health",
        tags: ["Health"],
        responses: {
            200: {
                description: "Service is healthy",
                content: {
                    "text/plain": {
                        schema: z.string().openapi({ example: "OK" }),
                    },
                },
            },
        },
    });

    app.openapi(healthRoute, (c) => c.text("OK"));

    // Swagger UI
    app.get("/docs", swaggerUI({ url: "/openapi.json" }));

    // OpenAPI JSON endpoint
    app.doc("/openapi.json", openAPIConfig);

    return app;
}

/**
 * Route definitions for documentation
 * These can be imported and used with OpenAPIHono
 */
export const routes = {
    // Worker shifts
    getWorkerShifts: createRoute({
        method: "get",
        path: "/worker/shifts",
        tags: ["Worker"],
        summary: "Get worker's shifts",
        description: "Retrieve shifts assigned to the authenticated worker",
        request: {
            query: z.object({
                status: z.enum(["upcoming", "history", "all"]).optional().default("upcoming"),
                limit: z.string().optional().default("20"),
                offset: z.string().optional().default("0"),
            }),
        },
        responses: {
            200: {
                description: "List of worker shifts",
                content: {
                    "application/json": {
                        schema: z.object({
                            shifts: z.array(WorkerShiftSchema),
                        }),
                    },
                },
            },
            401: {
                description: "Unauthorized",
                content: {
                    "application/json": {
                        schema: ErrorSchema,
                    },
                },
            },
        },
    }),

    // Clock in
    clockIn: createRoute({
        method: "post",
        path: "/clock-in",
        tags: ["Geofence"],
        summary: "Clock in to a shift",
        description: "Clock in with GPS location verification",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: ClockInRequestSchema,
                    },
                },
            },
        },
        responses: {
            200: {
                description: "Clock in successful",
                content: {
                    "application/json": {
                        schema: ClockInResponseSchema,
                    },
                },
            },
            400: {
                description: "Invalid request or outside geofence",
                content: {
                    "application/json": {
                        schema: ErrorSchema,
                    },
                },
            },
            429: {
                description: "Rate limited",
                content: {
                    "application/json": {
                        schema: ErrorSchema,
                    },
                },
            },
        },
    }),

    // Clock out
    clockOut: createRoute({
        method: "post",
        path: "/clock-out",
        tags: ["Geofence"],
        summary: "Clock out from a shift",
        description: "Clock out with GPS location verification",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: ClockInRequestSchema,
                    },
                },
            },
        },
        responses: {
            200: {
                description: "Clock out successful",
                content: {
                    "application/json": {
                        schema: ClockInResponseSchema,
                    },
                },
            },
            400: {
                description: "Invalid request or outside geofence",
                content: {
                    "application/json": {
                        schema: ErrorSchema,
                    },
                },
            },
        },
    }),

    // Request adjustment
    requestAdjustment: createRoute({
        method: "post",
        path: "/worker/adjustments",
        tags: ["Adjustments"],
        summary: "Request time correction",
        description: "Workers can request corrections to their clock in/out times",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: AdjustmentRequestSchema,
                    },
                },
            },
        },
        responses: {
            200: {
                description: "Adjustment request created",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            adjustmentId: z.string(),
                        }),
                    },
                },
            },
            400: {
                description: "Invalid request",
                content: {
                    "application/json": {
                        schema: ErrorSchema,
                    },
                },
            },
        },
    }),

    // Get pending adjustments (Manager+)
    getPendingAdjustments: createRoute({
        method: "get",
        path: "/adjustments/pending",
        tags: ["Adjustments"],
        summary: "Get pending adjustment requests",
        description: "Manager/Admin only: View pending time correction requests",
        responses: {
            200: {
                description: "List of pending adjustments",
                content: {
                    "application/json": {
                        schema: z.object({
                            adjustments: z.array(z.any()),
                        }),
                    },
                },
            },
            403: {
                description: "Access denied - requires manager role",
                content: {
                    "application/json": {
                        schema: ErrorSchema,
                    },
                },
            },
        },
    }),

    // Export timesheets (Manager+)
    exportTimesheets: createRoute({
        method: "get",
        path: "/timesheets/export",
        tags: ["Timesheets"],
        summary: "Export timesheets to CSV",
        description: "Manager/Admin only: Export timesheets for a date range",
        request: {
            query: z.object({
                from: z.string().datetime().optional(),
                to: z.string().datetime().optional(),
                workerId: z.string().optional(),
                locationId: z.string().optional(),
            }),
        },
        responses: {
            200: {
                description: "CSV file download",
                content: {
                    "text/csv": {
                        schema: z.string(),
                    },
                },
            },
            403: {
                description: "Access denied",
                content: {
                    "application/json": {
                        schema: ErrorSchema,
                    },
                },
            },
        },
    }),

    // Payment methods (Admin only)
    getPaymentMethods: createRoute({
        method: "get",
        path: "/billing/payment-methods",
        tags: ["Billing"],
        summary: "List payment methods",
        description: "Admin only: List saved payment methods",
        responses: {
            200: {
                description: "List of payment methods",
                content: {
                    "application/json": {
                        schema: z.object({
                            paymentMethods: z.array(z.any()),
                        }),
                    },
                },
            },
            403: {
                description: "Access denied - requires admin role",
                content: {
                    "application/json": {
                        schema: ErrorSchema,
                    },
                },
            },
        },
    }),
};
