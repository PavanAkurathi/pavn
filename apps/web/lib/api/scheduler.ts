"use server";

import type { SchedulingSettings } from "@repo/contracts/scheduler";
import { apiJsonRequest } from "@/lib/server/api-client";

export async function getSchedulingSettings(organizationId?: string): Promise<SchedulingSettings> {
    return apiJsonRequest<SchedulingSettings>("/scheduler/settings", {
        organizationScoped: true,
        organizationId,
    });
}
