import type { SchedulerWeek } from "@repo/contracts/scheduler";

/** Browser-side calls to the Scheduler API, through the organization-scoped proxy. */

export class SchedulerRequestError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly code?: string,
    ) {
        super(message);
        this.name = "SchedulerRequestError";
    }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`/api/scheduler/${path}`, {
        ...init,
        headers: { accept: "application/json", ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers },
        cache: "no-store",
    });
    const payload = response.headers.get("content-type")?.includes("application/json") ? await response.json() : null;
    if (!response.ok) {
        const message = typeof payload?.error === "string" ? payload.error : payload?.message ?? `Request failed (${response.status})`;
        throw new SchedulerRequestError(message, response.status, payload?.code);
    }
    return payload as T;
}

export function weekKey(locationId: string, weekStart: string | null) {
    return ["scheduler-week", locationId, weekStart ?? "current"] as const;
}

export function fetchSchedulerWeek([, locationId, weekStart]: ReturnType<typeof weekKey>): Promise<SchedulerWeek> {
    const params = new URLSearchParams({ locationId });
    if (weekStart !== "current") params.set("weekStart", weekStart);
    return request<SchedulerWeek>(`week?${params}`);
}

export { request as schedulerRequest };
