"use server";

import {
    assignWorkers,
    cancelShift,
    unassignWorker,
    updateTimesheet,
} from "@/lib/api/shifts";
import type { UpdateTimesheetPayload } from "@/lib/timesheet-utils";

type ShiftActionResult =
    | { success: true }
    | { error: string };

export async function assignWorkersToShiftAction(
    shiftId: string,
    workerIds: string[],
): Promise<ShiftActionResult> {
    try {
        await assignWorkers(shiftId, workerIds);
        return { success: true };
    } catch (error: any) {
        console.error("Failed to assign workers:", error);
        return { error: error?.message || "Failed to assign workers" };
    }
}

export async function unassignWorkerFromShiftAction(
    shiftId: string,
    workerId: string,
): Promise<ShiftActionResult> {
    try {
        await unassignWorker(shiftId, workerId);
        return { success: true };
    } catch (error: any) {
        console.error("Failed to remove worker:", error);
        return { error: error?.message || "Failed to remove worker" };
    }
}

export async function updateTimesheetAction(
    shiftId: string,
    workerId: string,
    payload: UpdateTimesheetPayload,
): Promise<ShiftActionResult> {
    try {
        await updateTimesheet(shiftId, workerId, "update_time", payload);
        return { success: true };
    } catch (error: any) {
        console.error("Failed to update timesheet:", error);
        return { error: error?.message || "Failed to update timesheet" };
    }
}

export async function cancelShiftAction(shiftId: string): Promise<ShiftActionResult> {
    try {
        await cancelShift(shiftId);
        return { success: true };
    } catch (error: any) {
        console.error("Failed to cancel shift:", error);
        return { error: error?.message || "Failed to cancel shift" };
    }
}
