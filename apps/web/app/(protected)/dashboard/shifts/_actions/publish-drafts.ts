"use server";

import { revalidatePath } from "next/cache";
import { publishDraftShifts } from "@/lib/api/shifts";
import { DASHBOARD_SHIFTS_PATH } from "@/lib/routes";

type PublishDraftsResult =
    | { success: true; published: number; notified: number; expired: number }
    | { error: string };

/**
 * Announce drafts that are already on the calendar. This is what closes the loop
 * on Copy last week: the copy fills the grid, this tells the workers.
 */
export async function publishDraftsAction(shiftIds: string[]): Promise<PublishDraftsResult> {
    if (shiftIds.length === 0) {
        return { error: "Nothing to publish." };
    }

    try {
        const result = await publishDraftShifts(shiftIds);

        revalidatePath(DASHBOARD_SHIFTS_PATH);

        return {
            success: true,
            published: result.published ?? 0,
            notified: result.notified ?? 0,
            expired: result.expired ?? 0,
        };
    } catch (error) {
        console.error("Failed to publish drafts:", error);
        const message = error instanceof Error ? error.message : "Failed to publish drafts";
        return { error: message };
    }
}
