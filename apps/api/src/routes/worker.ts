/**
 * @fileoverview Worker-Facing Routes
 * @module apps/api/routes/worker
 * 
 * Endpoints for workers (members) to view their shifts, set availability,
 * submit adjustment requests, and manage their profile.
 * 
 * @requires @repo/scheduling-timekeeping
 * @requires @repo/geofence
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
    AvailabilityResponseSchema,
    WorkerSchema,
} from "@repo/contracts/workforce";
import type { AppContext } from "../index";
import { getWorkerInviteByCode, getWorkerPhoneAccess } from "@repo/auth";
import {
    OpenApiLooseArraySchema,
    OpenApiLooseObjectSchema,
} from "../lib/openapi-schemas.js";
import { jsonOk } from "../lib/response.js";
import {
    OpenShiftsResponseSchema,
    SwapCandidatesResponseSchema,
    TimeOffCreatedSchema,
    TimeOffInputSchema,
    WorkerRequestActionSchema,
    WorkerRequestResultSchema,
    WorkerRequestsResponseSchema,
    WorkerShiftRequestInputSchema,
} from "@repo/contracts/requests";

// Import services
import {
    getWorkerShifts,
    getWorkerShiftById,
    getWorkerAllShifts,
    actOnRequest,
    createShiftRequest,
    createTimeOff,
    listOpenShifts,
    listSwapCandidates,
    listWorkerRequests,
} from "@repo/scheduling-timekeeping";
import {
    getAvailability,
    getWorkerOrganizations,
    setAvailability,
    updateWorkerProfile,
} from "@repo/gig-workers";

import {
    requestCorrection,
    getWorkerCorrections,
    CorrectionRequestSchema
} from "@repo/geofence";

export const workerRouter = new OpenAPIHono<AppContext>();

const workerAuthEligibilityRoute = createRoute({
    method: "post",
    path: "/auth/eligibility",
    summary: "Check Worker Phone Eligibility",
    description: "Check whether a business has invited this phone number to the worker app. If an invite code came with it, the code has to belong to the same person.",
    request: {
        body: {
            content: {
                "application/json": {
                    schema: z.object({
                        phoneNumber: z.string(),
                        inviteCode: z.string().optional(),
                    }),
                },
            },
        },
    },
    responses: {
        200: {
            description: "Eligibility check result",
            content: {
                "application/json": {
                    schema: z.object({
                        eligible: z.boolean(),
                        organizationCount: z.number().int().nonnegative(),
                        existingAccount: z.boolean(),
                        reason: z.enum(["invalid_code", "code_mismatch"]).optional(),
                    }),
                },
            },
        },
        400: { description: "Invalid phone number" },
    },
});

workerRouter.openapi(workerAuthEligibilityRoute, async (c) => {
    const body = await c.req.json();
    if (!body || typeof body.phoneNumber !== "string") {
        return c.json({ error: "Invalid phone number" }, 400);
    }

    try {
        const access = await getWorkerPhoneAccess(body.phoneNumber);

        if (typeof body.inviteCode === "string" && body.inviteCode.trim()) {
            const invite = await getWorkerInviteByCode(body.inviteCode);
            if (!invite) {
                return c.json({ eligible: false, organizationCount: 0, existingAccount: access.existingAccount, reason: "invalid_code" as const }, 200);
            }
            if (!access.workerAccess.some((row) => row.workerId === invite.workerId)) {
                return c.json({ eligible: false, organizationCount: 0, existingAccount: access.existingAccount, reason: "code_mismatch" as const }, 200);
            }
        }

        return c.json({
            eligible: access.eligible,
            organizationCount: access.organizationCount,
            existingAccount: access.existingAccount,
        }, 200);
    } catch {
        return c.json({ error: "Invalid phone number" }, 400);
    }
});

const workerInviteLookupRoute = createRoute({
    method: "get",
    path: "/auth/invite/{code}",
    summary: "Look Up Worker Invite",
    description: "What a business's invite code points at, so the app can say who invited the worker before they sign in.",
    request: { params: z.object({ code: z.string() }) },
    responses: {
        200: {
            description: "Invite",
            content: {
                "application/json": {
                    schema: z.object({
                        organizationName: z.string(),
                        workerName: z.string(),
                        phoneHint: z.string().nullable(),
                    }),
                },
            },
        },
        404: { description: "Not a valid invite" },
    },
});

workerRouter.openapi(workerInviteLookupRoute, async (c) => {
    const invite = await getWorkerInviteByCode(c.req.param("code"));
    if (!invite) {
        return c.json({ error: "This invite isn't valid anymore. Ask your manager to send a new one." }, 404);
    }
    return c.json({
        organizationName: invite.organizationName,
        workerName: invite.workerName,
        phoneHint: invite.phoneHint,
    }, 200);
});

// =============================================================================
// WORKER SHIFTS
// =============================================================================

const getShiftsRoute = createRoute({
    method: 'get',
    path: '/shifts',
    summary: 'Get Assigned Shifts',
    description: 'Get shifts assigned to the current worker (upcoming, history, or all).',
    request: {
        query: z.object({
            status: z.enum(['upcoming', 'history', 'all']).optional(),
            limit: z.string().optional(),
            offset: z.string().optional(),
        })
    },
    responses: {
        200: {
            content: {
                'application/json': { schema: OpenApiLooseArraySchema }
            },
            description: 'List of worker shifts'
        },
        401: { description: 'Unauthorized' }
    }
});

workerRouter.openapi(getShiftsRoute, async (c) => {
    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const status = (c.req.query("status") as "upcoming" | "history" | "all") || "upcoming";
    const limit = parseInt(c.req.query("limit") || "20");
    const offset = parseInt(c.req.query("offset") || "0");

    const result = await getWorkerShifts(user.id, orgId, { status, limit, offset });
    return jsonOk(c, result);
});

const getShiftDetailRoute = createRoute({
    method: 'get',
    path: '/shifts/{id}',
    summary: 'Get Worker Shift Detail',
    description: 'Get detailed shift information for the current worker within the active organization.',
    request: {
        params: z.object({
            id: z.string(),
        }),
    },
    responses: {
        200: {
            content: {
                'application/json': { schema: OpenApiLooseObjectSchema }
            },
            description: 'Worker shift detail'
        },
        401: { description: 'Unauthorized' },
        404: { description: 'Shift not found' }
    }
});

workerRouter.openapi(getShiftDetailRoute, async (c) => {
    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const shiftId = c.req.param("id");
    const result = await getWorkerShiftById(user.id, shiftId, orgId);
    return jsonOk(c, result);
});

// =============================================================================
// AVAILABILITY
// =============================================================================

const setAvailabilityRoute = createRoute({
    method: 'post',
    path: '/availability',
    summary: 'Set Availability',
    description: 'Set availability for the worker.',
    responses: {
        200: {
            description: 'Availability set successfully',
            content: { 'application/json': { schema: OpenApiLooseObjectSchema } }
        },
        401: { description: 'Unauthorized' }
    }
});

workerRouter.openapi(setAvailabilityRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const orgId = c.get("orgId");
    if (!orgId) return c.json({ error: "Organization context required" }, 400);

    const body = await c.req.json();
    const result = await setAvailability(body, user.id, orgId);
    return jsonOk(c, result);
});

const getAvailabilityRoute = createRoute({
    method: 'get',
    path: '/availability',
    summary: 'Get Availability',
    description: 'Get current availability for the worker.',
    responses: {
        200: {
            content: {
                'application/json': { schema: AvailabilityResponseSchema }
            },
            description: 'Current availability'
        },
        401: { description: 'Unauthorized' }
    }
});

workerRouter.openapi(getAvailabilityRoute, async (c) => {
    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const from = c.req.query("from") || new Date().toISOString();
    const to = c.req.query("to") || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    // Using service call
    const result = await getAvailability(orgId || "", from, to, user.id);
    return jsonOk(c, result);
});

// =============================================================================
// ADJUSTMENT REQUESTS
// =============================================================================

const requestAdjustmentRoute = createRoute({
    method: 'post',
    path: '/adjustments',
    summary: 'Request Time Adjustment',
    description: 'Submit a request to correct time logs.',
    responses: {
        200: {
            description: 'Request submitted successfully',
            content: { 'application/json': { schema: OpenApiLooseObjectSchema } }
        },
        401: { description: 'Unauthorized' }
    }
});

workerRouter.openapi(requestAdjustmentRoute, async (c) => {
    const user = c.get("user");
    const orgId = c.get("orgId");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const result = await requestCorrection(body, user.id, orgId);
    return c.json(result, 200);
});

const getAdjustmentsRoute = createRoute({
    method: 'get',
    path: '/adjustments',
    summary: 'Get Adjustment Requests',
    description: 'View submitted adjustment requests.',
    responses: {
        200: {
            content: {
                'application/json': { schema: z.array(CorrectionRequestSchema) }
            },
            description: 'List of adjustment requests'
        },
        401: { description: 'Unauthorized' }
    }
});

workerRouter.openapi(getAdjustmentsRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const orgId = c.get("orgId");
    const result = await getWorkerCorrections(user.id, orgId);
    return jsonOk(c, result);
});

// =============================================================================
// PROFILE
// =============================================================================

const getProfileRoute = createRoute({
    method: 'get',
    path: '/profile',
    summary: 'Get Profile',
    description: 'Get worker profile information.',
    responses: {
        200: {
            content: {
                'application/json': { schema: WorkerSchema }
            },
            description: 'Worker profile'
        },
        401: { description: 'Unauthorized' }
    }
});

workerRouter.openapi(getProfileRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const userRole = c.get("userRole");

    return jsonOk(c, {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: userRole || "member",
        status: "active"
    });
});

const updateProfileRoute = createRoute({
    method: 'patch',
    path: '/profile',
    summary: 'Update Profile',
    description: 'Update worker profile information.',
    responses: {
        200: {
            content: { 'application/json': { schema: WorkerSchema } },
            description: 'Updated profile'
        },
        400: { description: 'Invalid request' },
        401: { description: 'Unauthorized' },
        404: { description: 'Worker not found' }
    }
});

workerRouter.openapi(updateProfileRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const updated = await updateWorkerProfile(user.id, body);

    return jsonOk(c, {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        image: updated.image,
        role: "member",
        status: "active"
    });
});

export default workerRouter;

// =============================================================================
// CROSS-ORG ROUTES (no x-org-id required — query all memberships)
// =============================================================================

const allShiftsRoute = createRoute({
    method: 'get',
    path: '/all-shifts',
    summary: 'Get All Shifts (Cross-Org)',
    description: 'Get worker shifts across ALL organizations they belong to. Includes conflict detection for overlapping shifts.',
    responses: {
        200: { content: { 'application/json': { schema: OpenApiLooseObjectSchema } }, description: 'Shifts from all orgs' },
        401: { description: 'Unauthorized' }
    }
});

workerRouter.openapi(allShiftsRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const status = (c.req.query("status") || 'upcoming') as 'upcoming' | 'history' | 'in-progress' | 'all';
    const orgId = c.req.query("orgId") || undefined;
    const limit = parseInt(c.req.query("limit") || '50');
    const offset = parseInt(c.req.query("offset") || '0');

    const result = await getWorkerAllShifts(user.id, { status, orgId, limit, offset });
    return jsonOk(c, result);
});

const workerOrgsRoute = createRoute({
    method: 'get',
    path: '/organizations',
    summary: 'Get Worker Organizations',
    description: 'List all organizations the worker belongs to.',
    responses: {
        200: { content: { 'application/json': { schema: OpenApiLooseObjectSchema } }, description: 'Organization memberships' },
        401: { description: 'Unauthorized' }
    }
});

workerRouter.openapi(workerOrgsRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const organizations = await getWorkerOrganizations(user.id);

    return jsonOk(c, {
        organizations,
    });
});

// =============================================================================
// OPEN SHIFTS, REQUESTS AND TIME OFF (cross-org: each call checks membership
// against the shift's or request's own organization)
// =============================================================================

const json = <T extends z.ZodTypeAny>(schema: T) => ({ content: { "application/json": { schema } } });

const openShiftsRoute = createRoute({
    method: "get",
    path: "/open-shifts",
    summary: "Open shifts I can pick up",
    description: "Published shifts with open spots in the next four weeks, at every workplace, for roles I hold.",
    responses: {
        200: { ...json(OpenShiftsResponseSchema), description: "Open shifts" },
        401: { description: "Unauthorized" },
    },
});

workerRouter.openapi(openShiftsRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    return jsonOk(c, await listOpenShifts({ workerId: user.id }));
});

const myRequestsRoute = createRoute({
    method: "get",
    path: "/requests",
    summary: "My requests",
    description: "Claims, drops, swaps (mine and ones offered to me) and time off, with what I can do about each.",
    responses: {
        200: { ...json(WorkerRequestsResponseSchema), description: "Requests" },
        401: { description: "Unauthorized" },
    },
});

workerRouter.openapi(myRequestsRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    return jsonOk(c, await listWorkerRequests({ workerId: user.id }));
});

const createRequestRoute = createRoute({
    method: "post",
    path: "/requests",
    summary: "Claim, drop or swap a shift",
    description:
        "claim: take an open spot (right away or after a manager approves, per the workplace's policy). " +
        "drop: ask to come off a shift. swap: offer a shift to a named coworker, who accepts first.",
    request: { body: { ...json(WorkerShiftRequestInputSchema), required: true } },
    responses: {
        200: { ...json(WorkerRequestResultSchema), description: "Request made" },
        401: { description: "Unauthorized" },
        403: { description: "Not a member, or not set up for the role" },
        409: { description: "Full, started, already on it, or not free then" },
    },
});

workerRouter.openapi(createRequestRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    return jsonOk(c, await createShiftRequest({ workerId: user.id, body: c.req.valid("json") }));
});

const actOnRequestRoute = createRoute({
    method: "post",
    path: "/requests/{id}/{action}",
    summary: "Accept, decline or cancel a request",
    description: "Accept or decline a swap a coworker offered me, or cancel one of my own requests (including time off).",
    request: { params: z.object({ id: z.string().min(1), action: WorkerRequestActionSchema }) },
    responses: {
        200: { ...json(WorkerRequestResultSchema), description: "Done" },
        401: { description: "Unauthorized" },
        404: { description: "Request not found" },
        409: { description: "Already answered or no longer possible" },
    },
});

workerRouter.openapi(actOnRequestRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { id, action } = c.req.valid("param");
    return jsonOk(c, await actOnRequest({ workerId: user.id, id, action }));
});

const swapCandidatesRoute = createRoute({
    method: "get",
    path: "/swap-candidates",
    summary: "Coworkers who could take my shift",
    description: "People at the same workplace who hold the role, free ones first. Only whether they're free is shown.",
    request: { query: z.object({ shiftId: z.string().min(1) }) },
    responses: {
        200: { ...json(SwapCandidatesResponseSchema), description: "Coworkers" },
        401: { description: "Unauthorized" },
        409: { description: "Not on this shift" },
    },
});

workerRouter.openapi(swapCandidatesRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    return jsonOk(c, await listSwapCandidates({ workerId: user.id, shiftId: c.req.valid("query").shiftId }));
});

const timeOffRoute = createRoute({
    method: "post",
    path: "/time-off",
    summary: "Ask for time off",
    description: "Whole days or exact times, sent to every workplace unless `organizationIds` picks some.",
    request: { body: { ...json(TimeOffInputSchema), required: true } },
    responses: {
        200: { ...json(TimeOffCreatedSchema), description: "Sent" },
        400: { description: "Invalid or in the past" },
        401: { description: "Unauthorized" },
        409: { description: "Already asked for that time" },
    },
});

workerRouter.openapi(timeOffRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    return jsonOk(c, await createTimeOff({ workerId: user.id, body: c.req.valid("json") }));
});
