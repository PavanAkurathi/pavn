"use server";

import { revalidatePath } from "next/cache";
import {
    applyShiftTemplate,
    deleteShiftTemplate,
    getShiftTemplates,
    saveShiftAsTemplate,
    type ShiftTemplateSummary,
} from "@/lib/api/shifts";
import { DASHBOARD_SHIFTS_PATH } from "@/lib/routes";

export async function listTemplatesAction(): Promise<ShiftTemplateSummary[]> {
    return getShiftTemplates();
}

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

/**
 * Lay a template onto days. Produces drafts, so nothing reaches a worker until
 * the manager publishes.
 */
export async function applyTemplateAction(
    templateId: string,
    dates: string[],
): Promise<
    | { success: true; created: number; days: number; skippedDays: string[]; message?: string }
    | { error: string }
> {
    if (dates.length === 0) {
        return { error: "Pick at least one day." };
    }

    try {
        const result = await applyShiftTemplate(templateId, dates);
        revalidatePath(DASHBOARD_SHIFTS_PATH);
        return {
            success: true,
            created: result.created ?? 0,
            days: result.days ?? 0,
            skippedDays: result.skippedDays ?? [],
            message: result.message,
        };
    } catch (error) {
        console.error("Failed to apply template:", error);
        return { error: error instanceof Error ? error.message : "Failed to apply template" };
    }
}

export async function deleteTemplateAction(
    templateId: string,
): Promise<{ success: true } | { error: string }> {
    try {
        await deleteShiftTemplate(templateId);
        revalidatePath(DASHBOARD_SHIFTS_PATH);
        return { success: true };
    } catch (error) {
        console.error("Failed to delete template:", error);
        return { error: error instanceof Error ? error.message : "Failed to delete template" };
    }
}
