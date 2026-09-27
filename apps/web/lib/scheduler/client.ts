import type {
    SchedulerBlockingConflict,
    SchedulerChange,
    SchedulerChangesResult,
    SchedulerDiscardResult,
    SchedulerPublishPreview,
    SchedulerPublishResult,
    SchedulerTemplate,
    SchedulerWeek,
} from "@repo/contracts/scheduler";
import type { DecideRequestResult, ManagerRequestsResponse, RequestsSummary } from "@repo/contracts/requests";

/** Browser-side calls to the Scheduler API, through the organization-scoped proxy. */

export class SchedulerRequestError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly code?: string,
        readonly details?: unknown,
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
        throw new SchedulerRequestError(message, response.status, payload?.code, payload?.details);
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

export function postSchedulerChanges(changes: SchedulerChange[], force: boolean): Promise<SchedulerChangesResult> {
    return request<SchedulerChangesResult>("changes", { method: "POST", body: JSON.stringify({ changes, force }) });
}

export function discardWeek(locationId: string, weekStart: string): Promise<SchedulerDiscardResult> {
    return request<SchedulerDiscardResult>("week/discard", { method: "POST", body: JSON.stringify({ locationId, weekStart }) });
}

export function fetchTemplates(locationId: string): Promise<SchedulerTemplate[]> {
    return request<SchedulerTemplate[]>(`templates?${new URLSearchParams({ locationId })}`);
}

export function blockingConflictsOf(error: unknown): SchedulerBlockingConflict[] | null {
    if (!(error instanceof SchedulerRequestError) || error.code !== "SCHEDULE_CONFLICT") return null;
    const conflicts = (error.details as { conflicts?: SchedulerBlockingConflict[] } | undefined)?.conflicts;
    return Array.isArray(conflicts) ? conflicts : null;
}

export function fetchPublishPreview([, locationId, weekStart]: readonly [string, string, string]): Promise<SchedulerPublishPreview> {
    return request<SchedulerPublishPreview>(`week/publish-preview?${new URLSearchParams({ locationId, weekStart })}`);
}

export function publishWeek(locationId: string, weekStart: string, force: boolean): Promise<SchedulerPublishResult> {
    return request<SchedulerPublishResult>("week/publish", { method: "POST", body: JSON.stringify({ locationId, weekStart, force }) });
}

// ---- Requests ----------------------------------------------------------------

export const requestsKey = (view: "pending" | "recent") => ["scheduler-requests", view] as const;
export const REQUESTS_SUMMARY_KEY = "scheduler-requests-summary";

export function fetchRequests([, view]: ReturnType<typeof requestsKey>): Promise<ManagerRequestsResponse> {
    return request<ManagerRequestsResponse>(`requests?${new URLSearchParams({ view })}`);
}

export function fetchRequestsSummary(): Promise<RequestsSummary> {
    return request<RequestsSummary>("requests/summary");
}

export function decideRequest(id: string, decision: "approve" | "decline", body: { note?: string; force?: boolean }): Promise<DecideRequestResult> {
    return request<DecideRequestResult>(`requests/${encodeURIComponent(id)}/${decision}`, { method: "POST", body: JSON.stringify(body) });
}

/** The reasons a 409 gave for needing "Approve anyway". */
export function requestConflictsOf(error: unknown): string[] | null {
    if (!(error instanceof SchedulerRequestError) || error.code !== "SCHEDULE_CONFLICT") return null;
    const conflicts = (error.details as { conflicts?: unknown } | undefined)?.conflicts;
    return Array.isArray(conflicts) && conflicts.every((c) => typeof c === "string") ? conflicts : null;
}
