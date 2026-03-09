import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockGetAssignment = mock(() => Promise.resolve({ id: "asg_1" }));
const mockUpdateStatus = mock(() => Promise.resolve(undefined));
const mockUpdateTimesheetService = mock(() => Promise.resolve(undefined));

mock.module("../src/modules/time-tracking/service", () => ({
    AssignmentService: {
        getAssignment: mockGetAssignment,
        updateStatus: mockUpdateStatus,
        updateTimesheet: mockUpdateTimesheetService,
    },
}));

mock.module("@repo/observability", () => ({
    AppError: class extends Error {
        constructor(
            public message: string,
            public code: string,
            public statusCode: number,
            public data?: any
        ) {
            super(message);
        }
    },
}));

const { updateTimesheet } = await import("../src/modules/time-tracking/update-timesheet");

describe("updateTimesheet", () => {
    beforeEach(() => {
        mockGetAssignment.mockClear();
        mockUpdateStatus.mockClear();
        mockUpdateTimesheetService.mockClear();
        mockGetAssignment.mockResolvedValue({ id: "asg_1" });
    });

    test("scopes mark_no_show assignment lookup and status update to the active org", async () => {
        await updateTimesheet(
            { shiftId: "shift_1", workerId: "worker_1", action: "mark_no_show" },
            "org_1",
            "actor_1"
        );

        expect(mockGetAssignment).toHaveBeenCalledWith("shift_1", "worker_1", "org_1");
        expect(mockUpdateStatus).toHaveBeenCalledWith(
            "actor_1",
            "asg_1",
            "no_show",
            { reason: "Manager marked no-show" },
            "org_1"
        );
    });

    test("treats manual time updates as manager edits", async () => {
        await updateTimesheet(
            {
                shiftId: "shift_1",
                workerId: "worker_1",
                action: "update_time",
                data: {
                    clockIn: "2026-06-01T09:00:00.000Z",
                    clockOut: "2026-06-01T17:00:00.000Z",
                    breakMinutes: 30,
                },
            },
            "org_1",
            "actor_1"
        );

        expect(mockUpdateTimesheetService).toHaveBeenCalledTimes(1);
        const [actorId, orgId, shiftId, workerId, data, actorRole] = mockUpdateTimesheetService.mock.calls[0] as any[];

        expect(actorId).toBe("actor_1");
        expect(orgId).toBe("org_1");
        expect(shiftId).toBe("shift_1");
        expect(workerId).toBe("worker_1");
        expect(data.breakMinutes).toBe(30);
        expect(data.clockIn).toBeInstanceOf(Date);
        expect(data.clockOut).toBeInstanceOf(Date);
        expect(actorRole).toBe("manager");
    });
});
