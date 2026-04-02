export type Role = "admin" | "manager" | "member" | "owner";

export function normalizeOrganizationRole(role: string | null | undefined): Role {
    switch (role) {
        case "admin":
        case "manager":
        case "owner":
        case "member":
            return role;
        default:
            return "member";
    }
}

export function isAdminRole(role: Role | null | undefined): boolean {
    return role === "admin" || role === "owner";
}

export function isManagerRole(role: Role | null | undefined): boolean {
    return isAdminRole(role) || role === "manager";
}
