/**
 * Settings → Team answers "who can sign in and manage this business", so it lists
 * owners, admins and managers only. Workers are `member` rows and `member`
 * invitations; they belong on the Team page, not here, where a business with a
 * hundred workers would bury its handful of managers.
 */
const TEAM_ACCESS_ROLES = new Set(["owner", "admin", "manager"]);

export function hasTeamAccessRole(role: string | null | undefined): boolean {
    return TEAM_ACCESS_ROLES.has(role ?? "");
}

/**
 * The Team page is the worker roster. An invitation belongs on it only while it is
 * still open and only if it invites a worker; a manager's or admin's invitation,
 * or one that was accepted or cancelled, is not a worker waiting to start.
 */
export function isOpenWorkerInvitation(entry: { role: string | null; status: string | null }): boolean {
    return entry.status === "pending" && !hasTeamAccessRole(entry.role);
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
