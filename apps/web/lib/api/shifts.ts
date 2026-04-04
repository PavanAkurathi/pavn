"use server";

import { headers } from "next/headers";

import { getApiBaseUrl } from "@/lib/constants";
import { resolveActiveOrganizationId } from "@/lib/active-organization";
import { getApiSession } from "@/lib/server/auth-session";
import { getDashboardMockTimesheets, isDashboardMockShiftId } from "@/lib/shifts/data";

// Helper to secure Org ID
const getSecureOrgId = async (providedOrgId?: string) => {
    const session = await getApiSession();
    const sessionData = session as any;
    const activeOrgId = await resolveActiveOrganizationId(
        sessionData?.user?.id,
        sessionData?.session?.activeOrganizationId || sessionData?.activeOrganizationId
    );

    return activeOrgId || providedOrgId || null;
};

const requireSecureOrgId = async (providedOrgId?: string) => {
    const activeOrgId = await getSecureOrgId(providedOrgId);

    if (!activeOrgId) {
        throw new Error("No active organization available");
    }

    return activeOrgId;
};

// apps/web/lib/api/shifts.ts

// apps/web/lib/api/shifts.ts

export const getShifts = async ({ view, orgId }: { view: string; orgId?: string }) => {
    try {
        const shiftServiceUrl = getApiBaseUrl();
        const activeOrgId = await getSecureOrgId(orgId);

        if (!activeOrgId) {
            return [];
        }

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

        const res = await fetch(`${shiftServiceUrl}${endpoint}`, {
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

        const data = await res.json();
        return data.dateGroups || data;
    } catch (error) {
        console.error("Error fetching shifts:", error);
        return [];
    }
};

export const getPendingShiftsCount = async (orgId?: string) => {
    try {
        const shiftServiceUrl = getApiBaseUrl();
        const activeOrgId = await getSecureOrgId(orgId);

        if (!activeOrgId) {
            return 0;
        }

        const res = await fetch(`${shiftServiceUrl}/shifts/pending-approval`, {
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
    } catch (error) {
        console.error("Error fetching pending count:", error);
        return 0;
    }
};

export const getDraftShiftsCount = async (orgId?: string) => {
    try {
        const shiftServiceUrl = getApiBaseUrl();
        const activeOrgId = await getSecureOrgId(orgId);

        if (!activeOrgId) {
            return 0;
        }

        const res = await fetch(`${shiftServiceUrl}/shifts/drafts`, {
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
    } catch (error) {
        console.error("Error fetching draft count:", error);
        return 0;
    }
};

export const deleteDrafts = async (orgId?: string) => {
    const shiftServiceUrl = getApiBaseUrl();
    const activeOrgId = await requireSecureOrgId(orgId);
    const res = await fetch(`${shiftServiceUrl}/shifts/drafts`, {
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
    const shiftServiceUrl = getApiBaseUrl();
    const activeOrgId = await requireSecureOrgId(orgId);
    const res = await fetch(`${shiftServiceUrl}/shifts/publish`, {
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
    if (isDashboardMockShiftId(shiftId)) {
        return { ok: true, mock: true };
    }

    const shiftServiceUrl = getApiBaseUrl();
    const activeOrgId = await requireSecureOrgId(orgId);
    const res = await fetch(`${shiftServiceUrl}/shifts/${shiftId}/approve`, {
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
    const shiftServiceUrl = getApiBaseUrl();
    const activeOrgId = await getSecureOrgId(orgId);

    if (!activeOrgId) {
        return null;
    }

    const res = await fetch(`${shiftServiceUrl}/shifts/${shiftId}`, {
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
    if (isDashboardMockShiftId(shiftId)) {
        return getDashboardMockTimesheets(shiftId);
    }

    const shiftServiceUrl = getApiBaseUrl();
    const activeOrgId = await getSecureOrgId(orgId);

    if (!activeOrgId) {
        return [];
    }

    const res = await fetch(`${shiftServiceUrl}/shifts/${shiftId}/timesheets`, {
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
    if (isDashboardMockShiftId(shiftId)) {
        return { ok: true, mock: true, shiftId, workerId, action, data };
    }

    const shiftServiceUrl = getApiBaseUrl();
    const activeOrgId = await requireSecureOrgId(orgId);
    const res = await fetch(`${shiftServiceUrl}/shifts/${shiftId}/timesheet`, {
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

export const cancelShift = async (shiftId: string, orgId?: string) => {
    if (isDashboardMockShiftId(shiftId)) {
        return { ok: true, mock: true };
    }

    const shiftServiceUrl = getApiBaseUrl();
    const activeOrgId = await requireSecureOrgId(orgId);
    const res = await fetch(`${shiftServiceUrl}/shifts/${shiftId}/cancel`, {
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

export const assignWorkers = async (shiftId: string, workerIds: string[], orgId?: string) => {
    if (isDashboardMockShiftId(shiftId)) {
        return { ok: true, mock: true, workerIds };
    }

    const shiftServiceUrl = getApiBaseUrl();
    const activeOrgId = await requireSecureOrgId(orgId);
    const res = await fetch(`${shiftServiceUrl}/shifts/${shiftId}/assign`, {
        method: "POST",
        headers: {
            "x-org-id": activeOrgId,
            "Content-Type": "application/json",
            "Cookie": (await headers()).get("cookie") || "",
        },
        body: JSON.stringify({ workerIds }),
    });

    if (!res.ok) throw new Error(await res.text());
    return res.json();
};
