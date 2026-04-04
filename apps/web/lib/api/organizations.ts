"use server";

import type {
    Location,
    OrganizationInvitationState,
    OrganizationSummary,
    OrganizationWorkspace,
} from "@repo/contracts/organizations";
import type { SecurityOverview } from "@repo/contracts/preferences";
import type {
    Contact,
    CrewMember,
    RosterWorker,
    WorkerProfile,
} from "@repo/contracts/workforce";
import { apiJsonRequest } from "@/lib/server/api-client";

export async function getOrganizationSummary(
    organizationId?: string,
): Promise<OrganizationSummary | null> {
    return apiJsonRequest<OrganizationSummary | null>("/organizations/summary", {
        organizationScoped: true,
        organizationId,
    });
}

export async function getOrganizationLocations(organizationId?: string) {
    return apiJsonRequest<Location[]>("/organizations/locations", {
        organizationScoped: true,
        organizationId,
    });
}

export async function getOrganizationContacts(
    organizationId?: string,
): Promise<Contact[]> {
    return apiJsonRequest<Contact[]>("/organizations/members", {
        organizationScoped: true,
        organizationId,
    });
}

export async function getScheduleBootstrap(
    organizationId?: string,
): Promise<{ crew: CrewMember[] }> {
    return apiJsonRequest<{ crew: CrewMember[] }>(
        "/organizations/schedule/bootstrap",
        {
            organizationScoped: true,
            organizationId,
        },
    );
}

export async function getWorkspaceSettings(
    organizationId?: string,
): Promise<OrganizationWorkspace> {
    return apiJsonRequest<OrganizationWorkspace>(
        "/organizations/settings/workspace",
        {
            organizationScoped: true,
            organizationId,
        },
    );
}

export async function getRosterWorkers(
    organizationId?: string,
): Promise<RosterWorker[]> {
    return apiJsonRequest<RosterWorker[]>("/organizations/roster", {
        organizationScoped: true,
        organizationId,
    });
}

export async function getWorkerProfile(
    workerId: string,
    organizationId?: string,
): Promise<WorkerProfile> {
    return apiJsonRequest<WorkerProfile>(
        `/organizations/crew/${workerId}/profile`,
        {
            organizationScoped: true,
            organizationId,
        },
    );
}

export async function getSecurityOverview(): Promise<SecurityOverview> {
    return apiJsonRequest<SecurityOverview>("/preferences/security");
}

export async function getBusinessInvitation(
    invitationId: string,
): Promise<OrganizationInvitationState> {
    return apiJsonRequest<OrganizationInvitationState>(
        `/organizations/invitations/${invitationId}`,
    );
}
