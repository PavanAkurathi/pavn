"use server";

import {
    DepartmentInputSchema,
    DepartmentUpdateSchema,
    SchedulingSetupInputSchema,
    UpdateSchedulingSettingsSchema,
    type DepartmentInput,
    type DepartmentUpdate,
    type SchedulingDepartment,
    type SchedulingSettings,
    type SchedulingSetupInput,
    type UpdateSchedulingSettings,
} from "@repo/contracts/scheduler";
import { revalidatePath } from "next/cache";
import { apiJsonRequest } from "@/lib/server/api-client";

type Result<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

function refresh() {
    // The settings page is an optional catch-all, so a literal "/settings" misses its tabs.
    revalidatePath("/settings/[[...tab]]", "page");
    revalidatePath("/dashboard/onboarding");
    revalidatePath("/schedule");
}

async function call<T>(path: string, method: string, body?: unknown): Promise<Result<T>> {
    try {
        const data = await apiJsonRequest<T>(path, { method, body, organizationScoped: true });
        refresh();
        return { data };
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Something went wrong" };
    }
}

const firstIssue = (issues: { message: string }[]) => issues[0]?.message ?? "Check the form and try again";

export async function saveSchedulingSetup(input: SchedulingSetupInput): Promise<Result<SchedulingSettings>> {
    const parsed = SchedulingSetupInputSchema.safeParse(input);
    if (!parsed.success) return { error: firstIssue(parsed.error.issues) };
    return call("/scheduler/setup", "POST", parsed.data);
}

export async function saveSchedulingSettings(input: UpdateSchedulingSettings): Promise<Result<SchedulingSettings>> {
    const parsed = UpdateSchedulingSettingsSchema.safeParse(input);
    if (!parsed.success) return { error: firstIssue(parsed.error.issues) };
    return call("/scheduler/settings", "PATCH", parsed.data);
}

export async function addDepartment(input: DepartmentInput): Promise<Result<SchedulingDepartment>> {
    const parsed = DepartmentInputSchema.safeParse(input);
    if (!parsed.success) return { error: firstIssue(parsed.error.issues) };
    return call("/scheduler/departments", "POST", parsed.data);
}

export async function editDepartment(id: string, input: DepartmentUpdate): Promise<Result<SchedulingDepartment>> {
    const parsed = DepartmentUpdateSchema.safeParse(input);
    if (!parsed.success) return { error: firstIssue(parsed.error.issues) };
    return call(`/scheduler/departments/${encodeURIComponent(id)}`, "PATCH", parsed.data);
}

export async function removeDepartment(id: string): Promise<Result<{ id: string }>> {
    return call(`/scheduler/departments/${encodeURIComponent(id)}`, "DELETE");
}
