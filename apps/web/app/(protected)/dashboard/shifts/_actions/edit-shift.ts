"use server";

import { revalidatePath } from "next/cache";
import { editShift, type EditShiftPayload } from "@/lib/api/shifts";
import { DASHBOARD_SHIFTS_PATH } from "@/lib/routes";

type EditShiftResult =
    | { success: true; timeChanged: boolean; notified: number; unreachable: number }
    | { error: string };

/**
 * Change a shift that already exists — the times, the role, the headcount.
 *
 * Times go up as wall clock at the site. Turning them into an instant is the
 * server's job, next to the location's timezone, so a manager in California
 * editing a Boston shift types Boston hours.
 */
export async function editShiftAction(
    shiftId: string,
    payload: EditShiftPayload,
): Promise<EditShiftResult> {
    try {
        const result = await editShift(shiftId, payload);
        revalidatePath(DASHBOARD_SHIFTS_PATH);
        revalidatePath(`${DASHBOARD_SHIFTS_PATH}/${shiftId}/timesheet`);

        return {
            success: true,
            timeChanged: Boolean(result.timeChanged),
            notified: result.notified ?? 0,
            unreachable: result.unreachable ?? 0,
        };
    } catch (error) {
        console.error("Failed to edit shift:", error);
        return { error: error instanceof Error ? error.message : "Failed to edit shift" };
    }
}
