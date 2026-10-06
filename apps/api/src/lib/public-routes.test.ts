import { describe, expect, test } from "bun:test";
import { isPublicRoute } from "./public-routes";

describe("isPublicRoute", () => {
    test("a signed-out invitee can look up their invitation", () => {
        expect(isPublicRoute("GET", "/organizations/invitations/abc123")).toBe(true);
    });

    test("only the lookup is public, not accepting or listing", () => {
        expect(isPublicRoute("POST", "/organizations/invitations/abc123/accept")).toBe(false);
        expect(isPublicRoute("POST", "/organizations/invitations/abc123")).toBe(false);
        expect(isPublicRoute("DELETE", "/organizations/invitations/abc123")).toBe(false);
        expect(isPublicRoute("GET", "/organizations/invitations")).toBe(false);
        expect(isPublicRoute("GET", "/organizations/invitations/")).toBe(false);
    });

    test("other organization routes still need a session", () => {
        expect(isPublicRoute("GET", "/organizations/summary")).toBe(false);
        expect(isPublicRoute("GET", "/organizations/team/invitations/abc123")).toBe(false);
    });

    test("health, auth and the Stripe webhook stay public", () => {
        expect(isPublicRoute("GET", "/health")).toBe(true);
        expect(isPublicRoute("GET", "/ready")).toBe(true);
        expect(isPublicRoute("POST", "/api/auth/sign-in/email")).toBe(true);
        expect(isPublicRoute("POST", "/billing/webhooks/stripe")).toBe(true);
        expect(isPublicRoute("GET", "/billing/portal")).toBe(false);
    });
});
