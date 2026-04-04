/**
 * @fileoverview Organization Routes
 * @module apps/api/routes/organizations
 * 
 * Handles organization-level operations including crew management,
 * locations, and settings.
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { db, eq } from "@repo/database";
import { member } from "@repo/database/schema";
import {
    OrganizationDefaultContextSchema,
    OrganizationInvitationStateSchema,
    OrganizationProfileUpdateSchema,
    OrganizationSummarySchema,
    OrganizationWorkspaceSchema,
    TeamMemberInvitationInputSchema,
    LocationSchema,
    OrganizationSettingsSchema,
    UpdateOrganizationSettingsSchema,
} from "@repo/contracts/organizations";
import {
    BulkWorkerInviteInputSchema,
    BulkImportWorkersInputSchema,
    BulkImportWorkersResultSchema,
    ContactsSchema,
    CrewMemberSchema,
    RemoveWorkerByEmailSchema,
    RosterWorkersSchema,
    ScheduleBootstrapSchema,
    WorkerInviteInputSchema,
    WorkerProfileSchema,
} from "@repo/contracts/workforce";
import type { AppContext } from "../index.js";
import { isAdminRole, isManagerRole } from "../lib/organization-roles.js";

// Import from packages (Services)
import {
    createLocation,
    deleteLocation,
    getSettings,
    updateLocation,
    getLocations,
    updateSettings,
} from "@repo/organizations";
import {
    deactivateWorker,
    getCrew,
    inviteWorker,
    reactivateWorker,
    updateWorker,
} from "@repo/gig-workers";
import {
    acceptBusinessInvitation,
    bulkInviteWorkers,
    cancelTeamInvitation,
    createTeamInvitation,
    createWorkerInvitation,
    resendTeamInvitation,
} from "../lib/invitations.js";
import {
    bulkImportRosterEntries,
    createLocationWithPlanLimit,
    getOrganizationContacts,
    getOrganizationInvitationState,
    getOrganizationSummary,
    getRosterWorkers,
    getScheduleBootstrap,
    getWorkerProfile,
    getWorkspaceSettings,
    markBillingPromptHandled,
    removeOrganizationMember,
    removeWorkerByEmail,
    resendOrganizationMemberInvite,
    updateOrganizationProfile,
} from "../lib/organization-workspace.js";

export const organizationsRouter = new OpenAPIHono<AppContext>();

// =============================================================================
// CREW MANAGEMENT (Full Access: Admin/Manager)
// =============================================================================

const getCrewRoute = createRoute({
    method: 'get',
    path: '/crew',
    summary: 'Get Crew',
    description: 'List all workers in the organization.',
    request: {
        query: z.object({
            search: z.string().optional(),
            limit: z.string().optional(),
            offset: z.string().optional()
        })
    },
    responses: {
        200: { content: { 'application/json': { schema: z.array(CrewMemberSchema) } }, description: 'Crew list' },
        403: { description: 'Forbidden' }
    }
});

organizationsRouter.openapi(getCrewRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isManagerRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const search = c.req.query("search");
    const limit = parseInt(c.req.query("limit") || "50");
    const offset = parseInt(c.req.query("offset") || "0");

    const result = await getCrew(orgId, { search, limit, offset });
    return c.json(result as any, 200);
});

const inviteWorkerRoute = createRoute({
    method: 'post',
    path: '/crew/invite',
    summary: 'Invite Worker',
    description: 'Invite a new worker to the organization.',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        name: z.string().optional(),
                        email: z.string().email(),
                        phoneNumber: z.string().optional(),
                        role: z.enum(["admin", "member"]).optional(),
                        jobTitle: z.string().optional(),
                        roles: z.array(z.string()).optional(),
                        hourlyRate: z.number().int().nonnegative().optional(),
                    })
                }
            }
        }
    },
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Invitation sent' },
        403: { description: 'Forbidden' }
    }
});

organizationsRouter.openapi(inviteWorkerRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isManagerRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const result = await inviteWorker(body, orgId, user.id);
    return c.json(result as any, 200);
});

const createWorkerInvitationRoute = createRoute({
    method: "post",
    path: "/crew/invitations",
    summary: "Create Worker Invitation",
    description: "Create and deliver a worker invitation from the API boundary.",
    request: {
        body: {
            content: {
                "application/json": {
                    schema: WorkerInviteInputSchema,
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: z.object({
                        success: z.boolean(),
                        link: z.string().optional(),
                    }),
                },
            },
            description: "Worker invitation created",
        },
        403: { description: "Forbidden" },
    },
});

organizationsRouter.openapi(createWorkerInvitationRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isAdminRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const body = await c.req.json();
    const result = await createWorkerInvitation(c.req.raw.headers, orgId, body);
    return c.json(result, 200);
});

const bulkInviteWorkersRoute = createRoute({
    method: "post",
    path: "/crew/invitations/bulk",
    summary: "Bulk Invite Workers",
    description: "Create invitations for multiple roster entries.",
    request: {
        body: {
            content: {
                "application/json": {
                    schema: BulkWorkerInviteInputSchema,
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: z.object({
                        success: z.boolean(),
                        count: z.number(),
                    }),
                },
            },
            description: "Bulk invites processed",
        },
        403: { description: "Forbidden" },
    },
});

organizationsRouter.openapi(bulkInviteWorkersRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isAdminRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const body = await c.req.json();
    const result = await bulkInviteWorkers(c.req.raw.headers, orgId, body);
    return c.json(result, 200);
});

const bulkImportWorkersRoute = createRoute({
    method: "post",
    path: "/crew/import",
    summary: "Bulk Import Roster Entries",
    description: "Stage imported workers in the roster workspace.",
    request: {
        body: {
            content: {
                "application/json": {
                    schema: BulkImportWorkersInputSchema,
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: BulkImportWorkersResultSchema,
                },
            },
            description: "Bulk import result",
        },
        403: { description: "Forbidden" },
    },
});

organizationsRouter.openapi(bulkImportWorkersRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isAdminRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const body = await c.req.json();
    const result = await bulkImportRosterEntries(orgId, body);
    return c.json(result, 200);
});

const removeWorkerRoute = createRoute({
    method: "post",
    path: "/crew/remove",
    summary: "Remove Worker By Email",
    description: "Remove a worker, pending invite, or roster entry from the organization.",
    request: {
        body: {
            content: {
                "application/json": {
                    schema: RemoveWorkerByEmailSchema,
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: z.object({
                        success: z.boolean(),
                    }),
                },
            },
            description: "Worker removed",
        },
        403: { description: "Forbidden" },
    },
});

organizationsRouter.openapi(removeWorkerRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isAdminRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const body = await c.req.json();
    const result = await removeWorkerByEmail(orgId, body);
    return c.json(result, 200);
});

const updateWorkerRoute = createRoute({
    method: 'patch',
    path: '/crew/{id}',
    summary: 'Update Worker',
    description: 'Update worker details.',
    request: { params: z.object({ id: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Worker updated' },
        403: { description: 'Forbidden' }
    }
});

organizationsRouter.openapi(updateWorkerRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isManagerRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const id = c.req.param("id");
    const orgId = c.get("orgId");
    const body = await c.req.json();
    const result = await updateWorker(body, id, orgId);
    return c.json(result as any, 200);
});

const deactivateWorkerRoute = createRoute({
    method: 'delete',
    path: '/crew/{id}',
    summary: 'Deactivate Worker',
    description: 'Deactivate a worker account.',
    request: { params: z.object({ id: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Worker deactivated' },
        403: { description: 'Forbidden' }
    }
});

organizationsRouter.openapi(deactivateWorkerRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isManagerRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const id = c.req.param("id");
    const orgId = c.get("orgId");
    const result = await deactivateWorker(id, orgId);
    return c.json(result as any, 200);
});

const reactivateWorkerRoute = createRoute({
    method: 'post',
    path: '/crew/{id}/reactivate',
    summary: 'Reactivate Worker',
    description: 'Reactivate a suspended worker account.',
    request: { params: z.object({ id: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Worker reactivated' },
        403: { description: 'Forbidden' }
    }
});

organizationsRouter.openapi(reactivateWorkerRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isManagerRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const id = c.req.param("id");
    const orgId = c.get("orgId");
    const result = await reactivateWorker(id, orgId);
    return c.json(result as any, 200);
});

const createTeamInvitationRoute = createRoute({
    method: "post",
    path: "/team/invitations",
    summary: "Invite Team Member",
    description: "Create and deliver an admin or manager invitation.",
    request: {
        body: {
            content: {
                "application/json": {
                    schema: TeamMemberInvitationInputSchema,
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: z.object({
                        success: z.boolean(),
                        invitationId: z.string().optional(),
                    }),
                },
            },
            description: "Team invitation created",
        },
        403: { description: "Forbidden" },
    },
});

organizationsRouter.openapi(createTeamInvitationRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isAdminRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const body = await c.req.json();
    const result = await createTeamInvitation(c.req.raw.headers, orgId, body);
    return c.json(result, 200);
});

const resendTeamInvitationRoute = createRoute({
    method: "post",
    path: "/team/invitations/{id}/resend",
    summary: "Resend Team Invitation",
    description: "Regenerate and resend a pending admin or manager invitation.",
    request: {
        params: z.object({
            id: z.string(),
        }),
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: z.object({
                        success: z.boolean(),
                    }),
                },
            },
            description: "Invitation resent",
        },
        403: { description: "Forbidden" },
    },
});

organizationsRouter.openapi(resendTeamInvitationRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isAdminRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const invitationId = c.req.param("id");
    const result = await resendTeamInvitation(
        c.req.raw.headers,
        orgId,
        invitationId,
    );
    return c.json(result, 200);
});

const cancelTeamInvitationRoute = createRoute({
    method: "delete",
    path: "/team/invitations/{id}",
    summary: "Cancel Team Invitation",
    description: "Cancel a pending admin or manager invitation.",
    request: {
        params: z.object({
            id: z.string(),
        }),
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: z.object({
                        success: z.boolean(),
                    }),
                },
            },
            description: "Invitation canceled",
        },
        403: { description: "Forbidden" },
    },
});

organizationsRouter.openapi(cancelTeamInvitationRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isAdminRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const invitationId = c.req.param("id");
    const result = await cancelTeamInvitation(
        c.req.raw.headers,
        orgId,
        invitationId,
    );
    return c.json(result, 200);
});

const resendOrganizationMemberInviteRoute = createRoute({
    method: "post",
    path: "/team/members/{id}/resend",
    summary: "Resend Member Access Invite",
    description: "Resend a login reminder to an existing team member.",
    request: {
        params: z.object({
            id: z.string(),
        }),
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: z.object({
                        success: z.boolean(),
                        method: z.string(),
                    }),
                },
            },
            description: "Reminder sent",
        },
        403: { description: "Forbidden" },
    },
});

organizationsRouter.openapi(resendOrganizationMemberInviteRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isAdminRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const memberId = c.req.param("id");
    const result = await resendOrganizationMemberInvite(orgId, memberId);
    return c.json(result, 200);
});

const removeOrganizationMemberRoute = createRoute({
    method: "delete",
    path: "/team/members/{id}",
    summary: "Remove Team Member",
    description: "Remove an existing team member from the organization.",
    request: {
        params: z.object({
            id: z.string(),
        }),
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: z.object({
                        success: z.boolean(),
                    }),
                },
            },
            description: "Member removed",
        },
        403: { description: "Forbidden" },
    },
});

organizationsRouter.openapi(removeOrganizationMemberRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isAdminRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const memberId = c.req.param("id");
    const result = await removeOrganizationMember(orgId, memberId);
    return c.json(result, 200);
});

const acceptBusinessInvitationRoute = createRoute({
    method: "post",
    path: "/invitations/{id}/accept",
    summary: "Accept Business Invitation",
    description: "Accept a pending organization invitation for the current user.",
    request: {
        params: z.object({
            id: z.string(),
        }),
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: z.object({
                        success: z.boolean(),
                    }),
                },
            },
            description: "Invitation accepted",
        },
    },
});

organizationsRouter.openapi(acceptBusinessInvitationRoute, async (c) => {
    const invitationId = c.req.param("id");
    const result = await acceptBusinessInvitation(c.req.raw.headers, invitationId);
    return c.json(result, 200);
});

const getBusinessInvitationStateRoute = createRoute({
    method: "get",
    path: "/invitations/{id}",
    summary: "Get Business Invitation",
    description: "Fetch a pending business invitation for activation flows.",
    request: {
        params: z.object({
            id: z.string(),
        }),
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: OrganizationInvitationStateSchema,
                },
            },
            description: "Invitation state",
        },
        404: { description: "Invitation not found" },
    },
});

organizationsRouter.openapi(getBusinessInvitationStateRoute, async (c) => {
    const invitationId = c.req.param("id");
    const invitationState = await getOrganizationInvitationState(invitationId);

    if (!invitationState) {
        return c.json({ error: "Invitation not found" }, 404);
    }

    return c.json(invitationState, 200);
});

const getSummaryRoute = createRoute({
    method: "get",
    path: "/summary",
    summary: "Get Organization Summary",
    description: "Fetch minimal organization data for workspace chrome.",
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: OrganizationSummarySchema.nullable(),
                },
            },
            description: "Organization summary",
        },
        403: { description: "Forbidden" },
    },
});

organizationsRouter.openapi(getSummaryRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isManagerRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const result = await getOrganizationSummary(orgId);
    return c.json(result, 200);
});

const getDefaultOrganizationRoute = createRoute({
    method: "get",
    path: "/default",
    summary: "Get Default Organization",
    description: "Resolve the default organization for the authenticated user.",
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: OrganizationDefaultContextSchema,
                },
            },
            description: "Default organization context",
        },
    },
});

organizationsRouter.openapi(getDefaultOrganizationRoute, async (c) => {
    const session = c.get("session");
    const user = c.get("user");

    const activeOrganizationId = (session as any)?.activeOrganizationId || null;

    if (activeOrganizationId) {
        return c.json({ organizationId: activeOrganizationId }, 200);
    }

    if (!user) {
        return c.json({ organizationId: null }, 200);
    }

    const membership = await db.query.member.findFirst({
        where: eq(member.userId, user.id),
        columns: {
            organizationId: true,
        },
    });

    return c.json({ organizationId: membership?.organizationId ?? null }, 200);
});

const getMembersRoute = createRoute({
    method: "get",
    path: "/members",
    summary: "Get Organization Contacts",
    description: "Fetch organization contacts for schedule builders and pickers.",
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: ContactsSchema,
                },
            },
            description: "Contacts list",
        },
        403: { description: "Forbidden" },
    },
});

organizationsRouter.openapi(getMembersRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isManagerRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const result = await getOrganizationContacts(orgId);
    return c.json(result, 200);
});

const getScheduleBootstrapRoute = createRoute({
    method: "get",
    path: "/schedule/bootstrap",
    summary: "Get Schedule Bootstrap",
    description: "Fetch schedule form bootstrap data for the active organization.",
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: ScheduleBootstrapSchema,
                },
            },
            description: "Schedule bootstrap",
        },
        403: { description: "Forbidden" },
    },
});

organizationsRouter.openapi(getScheduleBootstrapRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isManagerRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const result = await getScheduleBootstrap(orgId);
    return c.json(result, 200);
});

const getWorkspaceSettingsRoute = createRoute({
    method: "get",
    path: "/settings/workspace",
    summary: "Get Workspace Settings",
    description: "Fetch organization settings data for the settings workspace.",
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: OrganizationWorkspaceSchema,
                },
            },
            description: "Workspace settings payload",
        },
        403: { description: "Forbidden" },
    },
});

organizationsRouter.openapi(getWorkspaceSettingsRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isManagerRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const result = await getWorkspaceSettings(orgId, user.id);
    return c.json(result, 200);
});

const getRosterRoute = createRoute({
    method: "get",
    path: "/roster",
    summary: "Get Roster",
    description: "Fetch the combined roster view for the active organization.",
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: RosterWorkersSchema,
                },
            },
            description: "Roster data",
        },
        403: { description: "Forbidden" },
    },
});

organizationsRouter.openapi(getRosterRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isManagerRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const result = await getRosterWorkers(orgId);
    return c.json(result, 200);
});

const getWorkerProfileRoute = createRoute({
    method: "get",
    path: "/crew/{id}/profile",
    summary: "Get Worker Profile",
    description: "Fetch a worker or staged roster profile.",
    request: {
        params: z.object({
            id: z.string(),
        }),
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: WorkerProfileSchema,
                },
            },
            description: "Worker profile",
        },
        403: { description: "Forbidden" },
        404: { description: "Not found" },
    },
});

organizationsRouter.openapi(getWorkerProfileRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isManagerRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const workerId = c.req.param("id");
    const result = await getWorkerProfile(orgId, workerId);

    if (!result) {
        return c.json({ error: "Worker not found" }, 404);
    }

    return c.json(result, 200);
});

// =============================================================================
// LOCATIONS
// =============================================================================

const getLocationsRoute = createRoute({
    method: 'get',
    path: '/locations',
    summary: 'Get Locations',
    description: 'List all organization locations.',
    responses: {
        200: { content: { 'application/json': { schema: z.array(LocationSchema) } }, description: 'Locations list' },
        403: { description: 'Forbidden' }
    }
});

organizationsRouter.openapi(getLocationsRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isManagerRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const result = await getLocations(orgId);
    return c.json(result as any, 200);
});

const createLocationRoute = createRoute({
    method: 'post',
    path: '/locations',
    summary: 'Create Location',
    description: 'Add a new location.',
    responses: {
        200: { content: { 'application/json': { schema: LocationSchema } }, description: 'Location created' },
        403: { description: 'Forbidden' }
    }
});

organizationsRouter.openapi(createLocationRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isAdminRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const body = await c.req.json();
    await createLocationWithPlanLimit(orgId, body);
    const result = await createLocation(body, orgId);
    return c.json(result as any, 200);
});

const updateLocationRoute = createRoute({
    method: 'patch',
    path: '/locations/{id}',
    summary: 'Update Location',
    description: 'Update location details.',
    request: { params: z.object({ id: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: LocationSchema } }, description: 'Location updated' },
        403: { description: 'Forbidden' }
    }
});

organizationsRouter.openapi(updateLocationRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isAdminRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const id = c.req.param("id");
    const orgId = c.get("orgId");
    const body = await c.req.json();
    const result = await updateLocation(body, id, orgId);
    return c.json(result as any, 200);
});

const deleteLocationRoute = createRoute({
    method: 'delete',
    path: '/locations/{id}',
    summary: 'Delete Location',
    description: 'Remove a location.',
    request: { params: z.object({ id: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: z.any() } }, description: 'Location deleted' },
        403: { description: 'Forbidden' }
    }
});

organizationsRouter.openapi(deleteLocationRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isAdminRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const id = c.req.param("id");
    const orgId = c.get("orgId");
    const result = await deleteLocation(id, orgId);
    return c.json(result as any, 200);
});

// =============================================================================
// ORGANIZATION SETTINGS (Manager/Admin)
// =============================================================================

const updateOrganizationProfileRoute = createRoute({
    method: "patch",
    path: "/profile",
    summary: "Update Organization Profile",
    description: "Update business profile details and onboarding metadata.",
    request: {
        body: {
            content: {
                "application/json": {
                    schema: OrganizationProfileUpdateSchema,
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: z.object({
                        success: z.boolean(),
                    }),
                },
            },
            description: "Profile updated",
        },
        403: { description: "Forbidden" },
    },
});

organizationsRouter.openapi(updateOrganizationProfileRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isAdminRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const body = await c.req.json();
    const result = await updateOrganizationProfile(orgId, body);
    return c.json(result, 200);
});

const markBillingPromptHandledRoute = createRoute({
    method: "post",
    path: "/profile/billing-prompt-handled",
    summary: "Mark Billing Prompt Handled",
    description: "Record that the billing setup prompt has been handled.",
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: z.object({
                        success: z.boolean(),
                    }),
                },
            },
            description: "Billing prompt marked handled",
        },
        403: { description: "Forbidden" },
    },
});

organizationsRouter.openapi(markBillingPromptHandledRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isAdminRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const result = await markBillingPromptHandled(orgId);
    return c.json(result, 200);
});

const updateSettingsRoute = createRoute({
    method: 'patch',
    path: '/settings',
    summary: 'Update Settings',
    description: 'Update organization settings.',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: UpdateOrganizationSettingsSchema,
                }
            }
        }
    },
    responses: {
        200: { content: { 'application/json': { schema: OrganizationSettingsSchema } }, description: 'Settings updated' },
        403: { description: 'Forbidden' }
    }
});

organizationsRouter.openapi(updateSettingsRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isAdminRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    const body = await c.req.json();
    const result = await updateSettings(body, orgId);
    return c.json(result as any, 200);
});

const getSettingsRoute = createRoute({
    method: 'get',
    path: '/settings',
    summary: 'Get Settings',
    description: 'Get organization settings.',
    responses: {
        200: { content: { 'application/json': { schema: OrganizationSettingsSchema } }, description: 'Settings' },
        403: { description: 'Forbidden' }
    }
});

organizationsRouter.openapi(getSettingsRoute, async (c) => {
    const userRole = c.get("userRole");
    if (!isManagerRole(userRole)) return c.json({ error: "Access denied" }, 403);

    const orgId = c.get("orgId");
    // getSettings logic in services/get-settings.ts takes orgId
    const result = await getSettings(orgId);
    return c.json(result as any, 200);
});

export default organizationsRouter;
