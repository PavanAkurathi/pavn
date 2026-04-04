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

export const AssignedWorkerSummarySchema = z.object({
    id: z.string(),
    name: z.string().optional(),
    avatarUrl: z.string().optional(),
    initials: z.string(),
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
    status: ShiftStatusSchema,
    workerId: z.string().optional(),
    capacity: ShiftCapacitySchema.optional(),
    assignedWorkers: z.array(AssignedWorkerSummarySchema).optional(),
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
});

export type ShiftStatus = z.infer<typeof ShiftStatusSchema>;
export type Shift = z.infer<typeof ShiftSchema>;
export type UpcomingShiftsResponse = z.infer<typeof UpcomingShiftsResponseSchema>;
export type Timesheet = z.infer<typeof TimesheetSchema>;
export type TimesheetReport = z.infer<typeof TimesheetReportSchema>;
export type TimesheetWorker = z.infer<typeof TimesheetWorkerSchema>;
