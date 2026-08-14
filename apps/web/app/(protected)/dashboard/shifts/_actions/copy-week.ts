"use server";

import { revalidatePath } from "next/cache";
import { copyWeek } from "@/lib/api/shifts";
import { DASHBOARD_SHIFTS_PATH } from "@/lib/routes";

type CopyWeekResult =
    | { success: true; copied: number; assignmentsCopied?: number; skippedDays: string[]; message?: string }
    | { error: string };

/**
 * Refill the week being viewed from the one before it. The API creates drafts,
 * so nothing is announced to workers until the manager publishes.
 */
export async function copyLastWeekAction(
    locationId: string,
    targetWeekStart: string,
): Promise<CopyWeekResult> {
    try {
        const result = (await copyWeek({ locationId, targetWeekStart })) as {
            copied: number;
            assignmentsCopied?: number;
            skippedDays?: string[];
            message?: string;
        };

        revalidatePath(DASHBOARD_SHIFTS_PATH);

        return {
            success: true,
            copied: result.copied ?? 0,
            assignmentsCopied: result.assignmentsCopied,
            skippedDays: result.skippedDays ?? [],
            message: result.message,
        };
    } catch (error) {
        console.error("Failed to copy last week:", error);
        const message = error instanceof Error ? error.message : "Failed to copy last week";
        return { error: message };
    }
}
