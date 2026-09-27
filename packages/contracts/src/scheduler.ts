import { z } from "zod";
import { AssignedWorkerKindSchema, ShiftStatusSchema } from "./shifts";

/**
 * The manager's weekly Scheduler: one read that carries everything the grid
 * draws. Times arrive as the location's wall clock ("HH:mm" on a local date),
 * next to the real instants, so a browser in another timezone never has to
 * convert anything.
 */

export const LocalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
export const LocalTimeSchema = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm");

export const OvertimePolicySchema = z.enum(["weekly_40", "daily_8"]);
export const ScheduleStyleSchema = z.enum(["steady", "events"]);
export const OpenShiftClaimPolicySchema = z.enum(["approval", "auto"]);
export const BusinessTypeSchema = z.enum(["restaurant", "retail", "events", "other"]);

export const SchedulerWeekQuerySchema = z.object({
    locationId: z.string().min(1),
    /** Any date inside the wanted week; defaults to the location's current week. */
    weekStart: LocalDateSchema.optional(),
});

export const ConflictTypeSchema = z.enum([
    "overlap",
    "time_off",
    "time_off_requested",
    "unavailable",
    "overtime",
    "role_mismatch",
]);

/**
 * `block` means the person should not work it as things stand (double-booked,
 * approved time off); `warn` is worth knowing but fine to override.
 */
export const ConflictSeveritySchema = z.enum(["block", "warn"]);

export const ConflictWarningSchema = z.object({
    type: ConflictTypeSchema,
    severity: ConflictSeveritySchema,
    message: z.string(),
});

/** A stretch of one day in the week, in the location's wall clock. */
export const SchedulerDaySpanSchema = z.object({
    dayIndex: z.number().int().min(0).max(6),
    startLocal: LocalTimeSchema,
    /** "24:00" when the span runs to midnight. */
    endLocal: z.string().regex(/^\d{2}:\d{2}$/),
    wholeDay: z.boolean(),
});

export const SchedulerDaySchema = z.object({
    index: z.number().int().min(0).max(6),
    localDate: LocalDateSchema,
    isToday: z.boolean(),
});

export const SchedulerDepartmentSchema = z.object({
    id: z.string(),
    name: z.string(),
    roles: z.array(z.string()),
});

export const SchedulerPersonSchema = z.object({
    /** User id, roster-entry id or temp-worker id, depending on `kind`. */
    id: z.string(),
    kind: AssignedWorkerKindSchema,
    name: z.string(),
    initials: z.string(),
    roles: z.array(z.string()),
    primaryRole: z.string().nullable(),
    departmentId: z.string().nullable(),
    agencyName: z.string().nullable(),
    /** Paid minutes this week across every location in the organization. */
    scheduledMinutes: z.number().int(),
    overtimeMinutes: z.number().int(),
});

export const PendingStateSchema = z.enum(["add", "remove"]);

export const SchedulerAssigneeSchema = z.object({
    personId: z.string(),
    kind: AssignedWorkerKindSchema,
    /** Staged until the week is published; null means staff already see it. */
    pendingState: PendingStateSchema.nullable(),
    warnings: z.array(ConflictWarningSchema),
});

export const SchedulerShiftSchema = z.object({
    id: z.string(),
    locationId: z.string(),
    /** Day of the week the shift starts on (0 = first day of the week in view). */
    dayIndex: z.number().int(),
    localDate: LocalDateSchema,
    startLocal: LocalTimeSchema,
    endLocal: LocalTimeSchema,
    /** Ends on the next local day. */
    overnight: z.boolean(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    role: z.string(),
    breakMinutes: z.number().int(),
    paidMinutes: z.number().int(),
    capacity: z.number().int(),
    filled: z.number().int(),
    open: z.number().int(),
    status: ShiftStatusSchema,
    /** A published shift with edits or people changes staff can't see yet. */
    hasUnpublishedEdits: z.boolean(),
    /** A published shift that disappears when the week is published. */
    pendingRemoval: z.boolean(),
    eventId: z.string().nullable(),
    note: z.string().nullable(),
    managerNote: z.string().nullable(),
    assignees: z.array(SchedulerAssigneeSchema),
});

export const SchedulerEventSchema = z.object({
    id: z.string(),
    name: z.string(),
    dayIndex: z.number().int(),
    localDate: LocalDateSchema,
    startLocal: LocalTimeSchema,
    endLocal: LocalTimeSchema,
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    notes: z.string().nullable(),
    needed: z.number().int(),
    filled: z.number().int(),
});

export const SchedulerTimeOffSchema = z.object({
    id: z.string(),
    personId: z.string(),
    status: z.enum(["approved", "pending"]),
    allDay: z.boolean(),
    reason: z.string().nullable(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    spans: z.array(SchedulerDaySpanSchema),
});

export const SchedulerUnavailableSchema = z.object({
    id: z.string(),
    personId: z.string(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    spans: z.array(SchedulerDaySpanSchema),
});

export const SchedulerWeekSchema = z.object({
    location: z.object({
        id: z.string(),
        name: z.string(),
        timezone: z.string(),
    }),
    weekStart: LocalDateSchema,
    weekStartsOn: z.number().int().min(0).max(6),
    days: z.array(SchedulerDaySchema).length(7),
    settings: z.object({
        overtimePolicy: OvertimePolicySchema,
        scheduleStyle: ScheduleStyleSchema,
        openShiftClaimPolicy: OpenShiftClaimPolicySchema,
    }),
    departments: z.array(SchedulerDepartmentSchema),
    people: z.array(SchedulerPersonSchema),
    shifts: z.array(SchedulerShiftSchema),
    events: z.array(SchedulerEventSchema),
    timeOff: z.array(SchedulerTimeOffSchema),
    unavailable: z.array(SchedulerUnavailableSchema),
    summary: z.object({
        openSlots: z.number().int(),
        /** Drafts, staged edits and staged removals at this location this week. */
        pendingChangeCount: z.number().int(),
        /** Claims, drops, swaps and time off waiting on a manager. */
        pendingRequestCount: z.number().int(),
    }),
});

export type OvertimePolicy = z.infer<typeof OvertimePolicySchema>;
export type ScheduleStyle = z.infer<typeof ScheduleStyleSchema>;
export type OpenShiftClaimPolicy = z.infer<typeof OpenShiftClaimPolicySchema>;
export type BusinessType = z.infer<typeof BusinessTypeSchema>;
export type SchedulerWeekQuery = z.infer<typeof SchedulerWeekQuerySchema>;
export type ConflictType = z.infer<typeof ConflictTypeSchema>;
export type ConflictSeverity = z.infer<typeof ConflictSeveritySchema>;
export type ConflictWarning = z.infer<typeof ConflictWarningSchema>;
export type SchedulerDaySpan = z.infer<typeof SchedulerDaySpanSchema>;
export type SchedulerDay = z.infer<typeof SchedulerDaySchema>;
export type SchedulerDepartment = z.infer<typeof SchedulerDepartmentSchema>;
export type SchedulerPerson = z.infer<typeof SchedulerPersonSchema>;
export type SchedulerAssignee = z.infer<typeof SchedulerAssigneeSchema>;
export type SchedulerShift = z.infer<typeof SchedulerShiftSchema>;
export type SchedulerEvent = z.infer<typeof SchedulerEventSchema>;
export type SchedulerTimeOff = z.infer<typeof SchedulerTimeOffSchema>;
export type SchedulerUnavailable = z.infer<typeof SchedulerUnavailableSchema>;
export type SchedulerWeek = z.infer<typeof SchedulerWeekSchema>;
