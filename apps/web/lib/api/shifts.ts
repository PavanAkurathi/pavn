"use server";

import type { Shift, TimesheetWorker } from "@/lib/types";
import { apiJsonRequest } from "@/lib/server/api-client";

type ShiftCollectionView = "upcoming" | "past" | "needs_approval" | "draft";
type ShiftCollectionPayload = Shift[] | { dateGroups?: Shift[] };

const SHIFT_COLLECTION_PATHS: Record<ShiftCollectionView, string> = {
    upcoming: "/shifts/upcoming",
    past: "/shifts/history",
    needs_approval: "/shifts/pending-approval",
    draft: "/shifts/drafts",
};

function normalizeShiftCollection(payload: ShiftCollectionPayload): Shift[] {
    return Array.isArray(payload) ? payload : payload.dateGroups ?? [];
}

async function getShiftCollection(
    view: ShiftCollectionView,
    organizationId?: string,
): Promise<Shift[]> {
    const payload = await apiJsonRequest<ShiftCollectionPayload>(
        SHIFT_COLLECTION_PATHS[view],
        {
            organizationScoped: true,
            organizationId,
        },
    );

    return normalizeShiftCollection(payload);
}

async function mutateShift<T>(
    path: string,
    options?: {
        method?: string;
        body?: unknown;
        organizationId?: string;
    },
): Promise<T> {
    return apiJsonRequest<T>(path, {
        method: options?.method || "POST",
        body: options?.body,
        organizationScoped: true,
        organizationId: options?.organizationId,
    });
}

export async function getShifts({
    view,
    orgId,
}: {
    view: string;
    orgId?: string;
}): Promise<Shift[]> {
    const normalizedView: ShiftCollectionView =
        view === "past"
            ? "past"
            : view === "needs_approval"
              ? "needs_approval"
              : view === "draft"
                ? "draft"
                : "upcoming";

    try {
        return await getShiftCollection(normalizedView, orgId);
    } catch (error) {
        console.error("Error fetching shifts:", error);
        return [];
    }
}

export async function getPendingShiftsCount(orgId?: string) {
    try {
        const pendingShifts = await getShiftCollection("needs_approval", orgId);
        return pendingShifts.length;
    } catch (error) {
        console.error("Error fetching pending count:", error);
        return 0;
    }
}

export async function getDraftShiftsCount(orgId?: string) {
    try {
        const draftShifts = await getShiftCollection("draft", orgId);
        return draftShifts.length;
    } catch (error) {
        console.error("Error fetching draft count:", error);
        return 0;
    }
}

export type ShiftTemplateSummary = {
    id: string;
    name: string;
    locationId: string;
    locationName: string;
    timezone?: string;
    startTime: string;
    endTime: string;
    positions: { roleName: string; headcount: number }[];
    headcount: number;
};

export async function getShiftTemplates(orgId?: string): Promise<ShiftTemplateSummary[]> {
    try {
        return await apiJsonRequest<ShiftTemplateSummary[]>("/shifts/templates", {
            organizationScoped: true,
            organizationId: orgId,
        });
    } catch (error) {
        console.error("Error fetching templates:", error);
        return [];
    }
}

export async function saveShiftAsTemplate(shiftId: string, name: string, orgId?: string) {
    return mutateShift<{ success: boolean; id: string; name: string }>("/shifts/templates", {
        body: { fromShiftId: shiftId, name },
        organizationId: orgId,
    });
}

export async function applyShiftTemplate(templateId: string, dates: string[], orgId?: string) {
    return mutateShift<{ created: number; days?: number; skippedDays: string[]; message?: string }>(
        `/shifts/templates/${templateId}/apply`,
        { body: { dates }, organizationId: orgId },
    );
}

export async function deleteShiftTemplate(templateId: string, orgId?: string) {
    return mutateShift<{ success: boolean }>(`/shifts/templates/${templateId}`, {
        method: "DELETE",
        organizationId: orgId,
    });
}

export async function getDraftShifts(orgId?: string): Promise<Shift[]> {
    try {
        return await getShiftCollection("draft", orgId);
    } catch (error) {
        console.error("Error fetching drafts:", error);
        return [];
    }
}

export async function publishDraftShifts(shiftIds: string[], orgId?: string) {
    return mutateShift<{ success: boolean; published: number; notified: number; expired: number }>(
        "/shifts/publish-drafts",
        {
            body: { shiftIds },
            organizationId: orgId,
        },
    );
}

export async function deleteDrafts(orgId?: string) {
    return mutateShift("/shifts/drafts", {
        method: "DELETE",
        organizationId: orgId,
    });
}

export async function publishSchedule(payload: unknown, orgId?: string) {
    return mutateShift("/shifts/publish", {
        body: payload,
        organizationId: orgId,
    });
}

export async function copyWeek(
    payload: { locationId: string; targetWeekStart: string },
    orgId?: string,
) {
    return mutateShift("/shifts/copy-week", {
        body: payload,
        organizationId: orgId,
    });
}

export async function approveShift(shiftId: string, orgId?: string) {
    return mutateShift(`/shifts/${shiftId}/approve`, {
        organizationId: orgId,
    });
}

export async function getShiftById(shiftId: string, orgId?: string): Promise<Shift | null> {
    try {
        return await apiJsonRequest<Shift>(`/shifts/${shiftId}`, {
            organizationScoped: true,
            organizationId: orgId,
        });
    } catch (error) {
        console.error(`Error fetching shift ${shiftId}:`, error);
        return null;
    }
}

export async function getShiftTimesheets(
    shiftId: string,
    orgId?: string,
): Promise<TimesheetWorker[]> {
    try {
        return await apiJsonRequest<TimesheetWorker[]>(`/shifts/${shiftId}/timesheets`, {
            organizationScoped: true,
            organizationId: orgId,
        });
    } catch (error) {
        console.error(`Error fetching timesheets for shift ${shiftId}:`, error);
        return [];
    }
}

export async function updateTimesheet(
    shiftId: string,
    workerId: string,
    action: string,
    data: unknown,
    orgId?: string,
) {
    return mutateShift(`/shifts/${shiftId}/timesheet`, {
        method: "PATCH",
        body: { shiftId, workerId, action, data },
        organizationId: orgId,
    });
}

export type EditShiftPayload = {
    title?: string;
    capacityTotal?: number;
    /** Wall-clock at the site; the server turns it into an instant. */
    local?: { date: string; startTime: string; endTime: string };
};

export async function editShift(shiftId: string, payload: EditShiftPayload, orgId?: string) {
    return mutateShift<{
        success: boolean;
        timeChanged: boolean;
        locationChanged: boolean;
        notified: number;
        unreachable: number;
    }>(`/shifts/${shiftId}`, {
        method: "PATCH",
        body: payload,
        organizationId: orgId,
    });
}

export async function cancelShift(shiftId: string, orgId?: string) {
    return mutateShift(`/shifts/${shiftId}/cancel`, {
        organizationId: orgId,
    });
}

export async function assignWorkers(
    shiftId: string,
    workerIds: string[],
    orgId?: string,
    tempWorkerIds: string[] = [],
    rosterEntryIds: string[] = [],
) {
    return mutateShift(`/shifts/${shiftId}/assign`, {
        body: { workerIds, tempWorkerIds, rosterEntryIds },
        organizationId: orgId,
    });
}

export async function unassignWorker(shiftId: string, workerId: string, orgId?: string) {
    return mutateShift(`/shifts/${shiftId}/assign/${workerId}`, {
        method: "DELETE",
        organizationId: orgId,
    });
}
