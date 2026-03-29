import { z } from "zod";

export const ShiftStatusSchema = z.enum(['draft', 'published', 'open', 'assigned', 'in-progress', 'completed', 'cancelled', 'approved']);

export const ShiftSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    locationId: z.string().optional(),
    locationName: z.string(),
    locationAddress: z.string().optional(),
    geofenceRadius: z.number().optional(),
    attendanceVerificationPolicy: z.enum(["strict_geofence", "soft_geofence", "none"]).optional(),
    contactId: z.string().nullable().optional(),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    status: ShiftStatusSchema,
    workerId: z.string().optional(),
    capacity: z.object({
        filled: z.number(),
        total: z.number()
    }).optional(),
    assignedWorkers: z.array(z.object({
        id: z.string(),
        name: z.string().optional(),
        avatarUrl: z.string().optional(),
        initials: z.string()
    })).optional()
});

export const UpcomingShiftsResponseSchema = z.array(ShiftSchema);

// Timesheet Schemas
export const TimesheetSchema = z.object({
    id: z.string(),
    workerId: z.string(),
    workerName: z.string(),
    shiftId: z.string().optional(),
    clockIn: z.string().datetime(),
    clockOut: z.string().datetime().optional(),
    durationMinutes: z.number().optional(),
    status: z.enum(['pending', 'approved', 'rejected', 'flagged']),
});

export const TimesheetReportSchema = z.object({
    summary: z.object({
        totalHours: z.number(),
        totalCost: z.number(),
        workerCount: z.number(),
    }),
    entries: z.array(TimesheetSchema),
});
