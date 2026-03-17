import { beforeEach, describe, expect, mock, test } from "bun:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";
import type { AppContext } from "../index";

const mockGetUpcomingShifts = mock(() => Promise.resolve([
    {
        id: "shift_1",
        title: "Morning Shift",
        locationName: "Venue",
        startTime: "2026-06-01T09:00:00.000Z",
        endTime: "2026-06-01T17:00:00.000Z",
        status: "published",
    },
]));
const mockUpdateTimesheet = mock(() => Promise.resolve({ success: true }));

const noop = mock(() => Promise.resolve([]));
const noopObject = mock(() => Promise.resolve({}));

mock.module("@repo/scheduling-timekeeping", () => {
    const ShiftSchema = z.object({
        id: z.string(),
        title: z.string(),
        description: z.string().optional(),
        locationId: z.string().optional(),
        locationName: z.string(),
        locationAddress: z.string().optional(),
        geofenceRadius: z.number().optional(),
        contactId: z.string().nullable().optional(),
        startTime: z.string().datetime(),
        endTime: z.string().datetime(),
        status: z.enum(['draft', 'published', 'open', 'assigned', 'in-progress', 'completed', 'cancelled', 'approved']),
        workerId: z.string().optional(),
        capacity: z.object({
            filled: z.number(),
            total: z.number(),
        }).optional(),
        assignedWorkers: z.array(z.object({
            id: z.string(),
            name: z.string().optional(),
            avatarUrl: z.string().optional(),
            initials: z.string(),
        })).optional(),
    });

    return {
        getUpcomingShifts: mockGetUpcomingShifts,
        getPendingShifts: noop,
        getHistoryShifts: noop,
        getDraftShifts: noop,
        deleteDrafts: noopObject,
        getShiftById: noopObject,
        getShiftGroup: noopObject,
        approveShift: noopObject,
        cancelShift: noopObject,
        assignWorker: noopObject,
        getShiftTimesheets: noop,
        updateTimesheet: mockUpdateTimesheet,
        publishSchedule: noopObject,
        editShift: noopObject,
        duplicateShift: noopObject,
        getOpenShifts: noop,
        unassignWorker: noopObject,
        UpcomingShiftsResponseSchema: z.array(ShiftSchema),
        ShiftSchema,
        TimesheetSchema: z.object({
            id: z.string(),
            workerId: z.string(),
            workerName: z.string(),
            shiftId: z.string().optional(),
            clockIn: z.string().datetime(),
            clockOut: z.string().datetime().optional(),
            durationMinutes: z.number().optional(),
            status: z.enum(['pending', 'approved', 'rejected', 'flagged']),
        }),
    };
});

const { shiftsRouter } = await import("./shifts");

const app = new OpenAPIHono<AppContext>();
app.use("*", async (c, next) => {
    c.set("userRole", "admin");
    c.set("orgId", "org_1");
    c.set("user", { id: "user_1" } as any);
    await next();
});
app.route("/shifts", shiftsRouter);

describe("shifts routes", () => {
    beforeEach(() => {
        mockGetUpcomingShifts.mockClear();
        mockUpdateTimesheet.mockClear();
    });

    test("GET /shifts/upcoming returns the array shape declared by the schema", async () => {
        const response = await app.request("/shifts/upcoming");
        expect(response.status).toBe(200);

        const body = await response.json();
        expect(Array.isArray(body)).toBe(true);
        expect(body[0]?.id).toBe("shift_1");
    });

    test("PATCH /shifts/:shiftId/timesheet rejects a mismatched body shiftId", async () => {
        const response = await app.request("/shifts/path_shift/timesheet", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                shiftId: "other_shift",
                workerId: "worker_1",
                action: "mark_no_show",
            }),
        });

        expect(response.status).toBe(400);
        expect(mockUpdateTimesheet).not.toHaveBeenCalled();
    });

    test("PATCH /shifts/:shiftId/timesheet uses the path shiftId when calling the service", async () => {
        const response = await app.request("/shifts/path_shift/timesheet", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                workerId: "worker_1",
                action: "mark_no_show",
            }),
        });

        expect(response.status).toBe(200);
        expect(mockUpdateTimesheet).toHaveBeenCalledWith(
            {
                shiftId: "path_shift",
                workerId: "worker_1",
                action: "mark_no_show",
            },
            "org_1",
            "user_1"
        );
    });
});
