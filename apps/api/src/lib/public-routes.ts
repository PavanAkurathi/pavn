/**
 * Requests the session check lets through. Everything else needs a signed-in user.
 *
 * The invitation lookup is public on purpose: a brand-new manager opens the
 * activation link before they have an account, and the unguessable invitation id
 * is the only credential they hold. Accepting it (POST .../accept) still needs a
 * session.
 */
const BUSINESS_INVITATION_LOOKUP = /^\/organizations\/invitations\/[^/]+$/;

export function isPublicRoute(method: string, path: string): boolean {
    if (
        path === "/health" ||
        path === "/ready" ||
        path.startsWith("/api/auth") ||
        path === "/billing/webhooks/stripe" ||
        path.startsWith("/worker/auth") ||
        path === "/docs" ||
        path === "/openapi.json" ||
        path === "/"
    ) {
        return true;
    }

    return method === "GET" && BUSINESS_INVITATION_LOOKUP.test(path);
}
