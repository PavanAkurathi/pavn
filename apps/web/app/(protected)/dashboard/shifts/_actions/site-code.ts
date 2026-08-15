"use server";

import { getSiteCode } from "@/lib/api/shifts";

type SiteCodeResult = { success: true; code: string } | { error: string };

/**
 * The four digits a supervisor reads out when the geofence will not let someone
 * clock in. Fetched on demand rather than shown by default — it is a fallback,
 * and putting it on screen permanently would make it the normal way in.
 */
export async function revealSiteCodeAction(shiftId: string): Promise<SiteCodeResult> {
    try {
        const result = await getSiteCode(shiftId);
        return { success: true, code: result.code };
    } catch (error) {
        console.error("Failed to get site code:", error);
        return { error: error instanceof Error ? error.message : "Could not get a site code" };
    }
}
