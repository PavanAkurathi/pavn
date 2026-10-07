/**
 * Settings → Team answers "who can sign in and manage this business", so it lists
 * owners, admins and managers only. Workers have their own list (the Team
 * page); a business with a hundred workers would bury its handful of managers here.
 */
const TEAM_ACCESS_ROLES = new Set(["owner", "admin", "manager"]);

export function hasTeamAccessRole(role: string | null | undefined): boolean {
    return TEAM_ACCESS_ROLES.has(role ?? "");
}

type Dated = { joinedAt: Date | string };

export function buildTeamAccessList<T extends { role: string } & Dated>(
    entries: T[],
): T[] {
    return entries
        .filter((entry) => hasTeamAccessRole(entry.role))
        .sort(
            (left, right) =>
                new Date(right.joinedAt).getTime() - new Date(left.joinedAt).getTime(),
        );
}
