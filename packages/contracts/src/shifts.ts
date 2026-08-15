import { z } from "zod";
import { AttendanceVerificationPolicySchema } from "./shared";

export const ShiftStatusSchema = z.enum([
    "draft",
    "published",
    "open",
    "assigned",
    "in-progress",
    "completed",
    "cancelled",
    "approved",
]);

export const ShiftCapacitySchema = z.object({
    filled: z.number(),
    total: z.number(),
});

/**
 * How a person came to be on the shift. The three are operationally different:
 * a roster worker has an account and clocks themselves in, an invited worker has
 * not accepted yet, and an agency worker never logs in at all.
 */
export const AssignedWorkerKindSchema = z.enum(["roster", "invited", "agency"]);

export const AssignedWorkerSummarySchema = z.object({
    id: z.string(),
    name: z.string().optional(),
    avatarUrl: z.string().optional(),
    initials: z.string(),
    kind: AssignedWorkerKindSchema.optional(),
});

export const ShiftSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    locationId: z.string().optional(),
    locationName: z.string(),
    locationAddress: z.string().optional(),
    geofenceRadius: z.number().optional(),
    attendanceVerificationPolicy: AttendanceVerificationPolicySchema.optional(),
    contactId: z.string().nullable().optional(),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    /** IANA zone the shift is anchored to — the location's, not the viewer's. */
    timezone: z.string().nullable().optional(),
    status: ShiftStatusSchema,
    workerId: z.string().optional(),
    capacity: ShiftCapacitySchema.optional(),
    assignedWorkers: z.array(AssignedWorkerSummarySchema).optional(),
    createdAt: z.string().optional(),
});

export const UpcomingShiftsResponseSchema = z.array(ShiftSchema);

export const TimesheetSchema = z.object({
    id: z.string(),
    workerId: z.string(),
    workerName: z.string(),
    shiftId: z.string().optional(),
    clockIn: z.string().datetime(),
    clockOut: z.string().datetime().optional(),
    durationMinutes: z.number().optional(),
    status: z.enum(["pending", "approved", "rejected", "flagged"]),
});

export const TimesheetReportSchema = z.object({
    summary: z.object({
        totalHours: z.number(),
        totalCost: z.number(),
        workerCount: z.number(),
    }),
    entries: z.array(TimesheetSchema),
});

export const TimesheetWorkerSchema = z.object({
    id: z.string(),
    /** Roster user id, or temp worker id when isTemp is true. */
    workerId: z.string(),
    isTemp: z.boolean().optional(),
    invitePending: z.boolean().optional(),
    agency: z.string().optional(),
    phone: z.string().optional(),
    name: z.string(),
    avatarUrl: z.string().optional(),
    avatarInitials: z.string(),
    role: z.string(),
    clockIn: z.string().optional(),
    clockOut: z.string().optional(),
    breakMinutes: z.number(),
    status: z.enum([
        "rostered",
        "new",
        "blocked",
        "submitted",
        "approved",
        "no-show",
        "cancelled",
    ]),
    /**
     * Set when a manager has changed these hours by hand. A manager may override
     * anything, but the record of what it was before travels with the row so the
     * change is never silent.
     */
    edited: z
        .object({
            by: z.string(),
            at: z.string(),
            previousClockIn: z.string().optional(),
            previousClockOut: z.string().optional(),
            previousBreakMinutes: z.number().optional(),
        })
        .optional(),
});

export type ShiftStatus = z.infer<typeof ShiftStatusSchema>;
export type Shift = z.infer<typeof ShiftSchema>;
export type UpcomingShiftsResponse = z.infer<typeof UpcomingShiftsResponseSchema>;
export type Timesheet = z.infer<typeof TimesheetSchema>;
export type TimesheetReport = z.infer<typeof TimesheetReportSchema>;
export type TimesheetWorker = z.infer<typeof TimesheetWorkerSchema>;
