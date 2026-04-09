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

export async function cancelShift(shiftId: string, orgId?: string) {
    return mutateShift(`/shifts/${shiftId}/cancel`, {
        organizationId: orgId,
    });
}

export async function assignWorkers(shiftId: string, workerIds: string[], orgId?: string) {
    return mutateShift(`/shifts/${shiftId}/assign`, {
        body: { workerIds },
        organizationId: orgId,
    });
}

export async function unassignWorker(shiftId: string, workerId: string, orgId?: string) {
    return mutateShift(`/shifts/${shiftId}/assign/${workerId}`, {
        method: "DELETE",
        organizationId: orgId,
    });
}
