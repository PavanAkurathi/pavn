"use server";

import { auth } from "@repo/auth";
import { headers } from "next/headers";

const SHIFT_SERVICE_URL = process.env.SHIFT_SERVICE_URL || "http://localhost:4005";

// Helper to secure Org ID
const getSecureOrgId = async (providedOrgId?: string) => {
    // If running on server with full trust (e.g. from page.tsx props), we might trust providedOrgId
    // But for Client->Server calls, we MUST verify.
    // Simpler approach: Always derive from session if possible, or fallback.
    const session = await auth.api.getSession({ headers: await headers() });
    const sessionData = session as any;
    let activeOrgId = sessionData?.session?.activeOrganizationId || sessionData?.activeOrganizationId;

    // FALLBACK: If session has no Active Org, query DB for first membership
    if (!activeOrgId && sessionData?.user?.id) {
        try {
            const { db } = await import("@repo/database");
            const { member } = await import("@repo/database/schema");
            const { eq } = await import("drizzle-orm");

            const firstMember = await db.query.member.findFirst({
                where: eq(member.userId, sessionData.user.id)
            });
            if (firstMember) activeOrgId = firstMember.organizationId;
        } catch (e) {
            console.error("Failed to auto-resolve orgId in API utils", e);
        }
    }

    return activeOrgId || providedOrgId || "org_default";
};

export const getShifts = async ({ view, orgId }: { view: string; orgId?: string }) => {
    const activeOrgId = await getSecureOrgId(orgId);

    let endpoint = "";
    switch (view) {
        case "upcoming":
            endpoint = "/shifts/upcoming";
            break;
        case "past":
            endpoint = "/shifts/history";
            break;
        case "needs_approval":
            endpoint = "/shifts/pending-approval";
            break;
        case "draft":
            endpoint = "/shifts/drafts";
            break;
        default:
            endpoint = "/shifts/upcoming";
    }

    const res = await fetch(`${SHIFT_SERVICE_URL}${endpoint}`, {
        headers: {
            "x-org-id": activeOrgId,
            "Content-Type": "application/json",
            "Cookie": (await headers()).get("cookie") || "",
        },
        cache: "no-store",
    });

    if (!res.ok) {
        console.error(`Failed to fetch shifts: ${res.status} ${res.statusText}`);
        return [];
    }

    return res.json();
};

export const getPendingShiftsCount = async (orgId?: string) => {
    const activeOrgId = await getSecureOrgId(orgId);
    const res = await fetch(`${SHIFT_SERVICE_URL}/shifts/pending-approval`, {
        headers: {
            "x-org-id": activeOrgId,
            "Content-Type": "application/json",
            "Cookie": (await headers()).get("cookie") || "",
        },
        cache: "no-store",
    });

    if (!res.ok) return 0;
    const shifts = await res.json() as any[];
    return shifts.length;
};

export const getDraftShiftsCount = async (orgId?: string) => {
    const activeOrgId = await getSecureOrgId(orgId);
    const res = await fetch(`${SHIFT_SERVICE_URL}/shifts/drafts`, {
        headers: {
            "x-org-id": activeOrgId,
            "Content-Type": "application/json",
            "Cookie": (await headers()).get("cookie") || "",
        },
        cache: "no-store",
    });

    if (!res.ok) return 0;
    const shifts = await res.json() as any[];
    return shifts.length;
};

export const deleteDrafts = async (orgId?: string) => {
    const activeOrgId = await getSecureOrgId(orgId);
    const res = await fetch(`${SHIFT_SERVICE_URL}/shifts/drafts`, {
        method: "DELETE",
        headers: {
            "x-org-id": activeOrgId,
            "Content-Type": "application/json",
            "Cookie": (await headers()).get("cookie") || "",
        },
    });

    if (!res.ok) throw new Error(await res.text());
    return res.json();
};

export const publishSchedule = async (payload: any, orgId?: string) => {
    const activeOrgId = await getSecureOrgId(orgId);
    const res = await fetch(`${SHIFT_SERVICE_URL}/schedules/publish`, {
        method: "POST",
        headers: {
            "x-org-id": activeOrgId,
            "Content-Type": "application/json",
            "Cookie": (await headers()).get("cookie") || "",
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(await res.text());
    return res.json();
};

export const approveShift = async (shiftId: string, orgId?: string) => {
    const activeOrgId = await getSecureOrgId(orgId);
    const res = await fetch(`${SHIFT_SERVICE_URL}/shifts/${shiftId}/approve`, {
        method: "POST",
        headers: {
            "x-org-id": activeOrgId,
            "Content-Type": "application/json",
            "Cookie": (await headers()).get("cookie") || "",
        },
    });

    if (!res.ok) throw new Error(await res.text());
    return res.json();
};

export const getShiftById = async (shiftId: string, orgId?: string) => {
    const activeOrgId = await getSecureOrgId(orgId);
    const res = await fetch(`${SHIFT_SERVICE_URL}/shifts/${shiftId}`, {
        headers: {
            "x-org-id": activeOrgId,
            "Content-Type": "application/json",
            "Cookie": (await headers()).get("cookie") || "",
        },
        cache: "no-store",
    });

    if (!res.ok) return null;
    return res.json();
};

export const getShiftTimesheets = async (shiftId: string, orgId?: string) => {
    const activeOrgId = await getSecureOrgId(orgId);
    const res = await fetch(`${SHIFT_SERVICE_URL}/shifts/${shiftId}/timesheets`, {
        headers: {
            "x-org-id": activeOrgId,
            "Content-Type": "application/json",
            "Cookie": (await headers()).get("cookie") || "",
        },
        cache: "no-store",
    });

    if (!res.ok) return [];
    return res.json();
};

export const updateTimesheet = async (shiftId: string, workerId: string, action: string, data: any, orgId?: string) => {
    const activeOrgId = await getSecureOrgId(orgId);
    const res = await fetch(`${SHIFT_SERVICE_URL}/shifts/${shiftId}/timesheet`, {
        method: "PATCH",
        headers: {
            "x-org-id": activeOrgId,
            "Content-Type": "application/json",
            "Cookie": (await headers()).get("cookie") || "",
        },
        body: JSON.stringify({ shiftId, workerId, action, data }),
    });

    if (!res.ok) throw new Error(await res.text());
    return res.json();
};
