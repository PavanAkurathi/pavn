"use server";

import { revalidatePath } from "next/cache";
import { saveShiftAsTemplate } from "@/lib/api/shifts";
import { DASHBOARD_SHIFTS_PATH } from "@/lib/routes";

/**
 * Lift the shape off a shift that already exists — the whole block, every role
 * in it, not just the row that was clicked.
 */
export async function saveAsTemplateAction(
    shiftId: string,
    name: string,
): Promise<{ success: true; name: string } | { error: string }> {
    const trimmed = name.trim();
    if (!trimmed) {
        return { error: "Give the template a name." };
    }

    try {
        const result = await saveShiftAsTemplate(shiftId, trimmed);
        revalidatePath(DASHBOARD_SHIFTS_PATH);
        return { success: true, name: result.name ?? trimmed };
    } catch (error) {
        console.error("Failed to save template:", error);
        return { error: error instanceof Error ? error.message : "Failed to save template" };
    }
}
