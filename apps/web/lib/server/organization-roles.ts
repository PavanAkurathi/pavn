export type OrganizationRole = "admin" | "manager" | "member" | "owner" | string;
export type BusinessTeamInvitationRole = "admin" | "manager";

export function isAdminOrganizationRole(role: OrganizationRole | null | undefined): boolean {
    return role === "admin" || role === "owner";
}

export function isManagerOrganizationRole(role: OrganizationRole | null | undefined): boolean {
    return isAdminOrganizationRole(role) || role === "manager";
}

export function requiresBusinessOnboarding(role: OrganizationRole | null | undefined): boolean {
    return isAdminOrganizationRole(role);
}

export function isBusinessTeamInvitationRole(
    role: OrganizationRole | null | undefined
): role is BusinessTeamInvitationRole {
    return role === "admin" || role === "manager";
}
