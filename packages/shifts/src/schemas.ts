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
    contactId: z.string().nullable().optional(),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    status: ShiftStatusSchema,
    workerId: z.string().optional(),
    price: z.number().optional(),
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

// Worker / Crew Schemas
export const WorkerSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    image: z.string().optional().nullable(),
    role: z.string().optional(),
    status: z.string().optional(),
});

export const CrewListResponseSchema = z.object({
    crew: z.array(WorkerSchema),
    total: z.number(),
    page: z.number(),
});

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

// Availability Schemas
export const AvailabilitySchema = z.object({
    date: z.string(), // YYYY-MM-DD
    slots: z.array(z.object({
        start: z.string(), // HH:mm
        end: z.string(), // HH:mm
    })),
    status: z.enum(['available', 'unavailable', 'partial']),
});

export const AvailabilityResponseSchema = z.array(AvailabilitySchema);

// Billing & Location Schemas (Mock for now to match controller outputs)
export const BillingInfoSchema = z.object({
    plan: z.string(),
    status: z.string(),
    currentPeriodEnd: z.string(),
    usage: z.object({
        workers: z.number(),
        shifts: z.number(),
    }),
});

export const LocationSchema = z.object({
    id: z.string(),
    name: z.string(),
    address: z.string(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    radius: z.number().optional(),
});

