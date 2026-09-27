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

// ---------------------------------------------------------------------------
// Editing: every grid action is a batch of small changes, applied atomically.
// Each batch answers with the changes that undo it, so undo and redo work the
// same way for every action.
// ---------------------------------------------------------------------------

/** Shift ids for new shifts are made by the client so later changes in the same batch can refer to them. */
export const NewShiftIdSchema = z.string().regex(/^shf_[0-9A-Za-z]{16}$/, "Expected a shift id like shf_0123456789abcdef");

export const SchedulerPersonRefSchema = z.object({
    personId: z.string().min(1),
    kind: AssignedWorkerKindSchema,
});

const RoleSchema = z.string().trim().min(1, "Pick a role").max(60);
const CapacitySchema = z.number().int().min(1, "At least one person").max(200);
const BreakSchema = z.number().int().min(0).max(240);
const NoteSchema = z.string().trim().max(1000).nullable();

export const SchedulerShiftFieldsSchema = z.object({
    locationId: z.string().min(1),
    localDate: LocalDateSchema,
    /** Wall-clock start; an end at or before it means the next day. */
    startLocal: LocalTimeSchema,
    endLocal: LocalTimeSchema,
    role: RoleSchema,
    capacity: CapacitySchema.default(1),
    /** Unpaid break. Defaults to 30 minutes for shifts over 6 hours. */
    breakMinutes: BreakSchema.optional(),
    /** Shown to staff. */
    note: NoteSchema.optional(),
    /** Only managers see it. */
    managerNote: NoteSchema.optional(),
    eventId: z.string().nullable().optional(),
});

export const SchedulerShiftPatchSchema = z.object({
    localDate: LocalDateSchema.optional(),
    startLocal: LocalTimeSchema.optional(),
    endLocal: LocalTimeSchema.optional(),
    role: RoleSchema.optional(),
    capacity: CapacitySchema.optional(),
    breakMinutes: BreakSchema.optional(),
    note: NoteSchema.optional(),
    managerNote: NoteSchema.optional(),
    eventId: z.string().nullable().optional(),
    /** Stage (true) or un-stage (false) the removal of a published shift. */
    cancel: z.boolean().optional(),
}).strict();

export const NewEventIdSchema = z.string().regex(/^evt_[0-9A-Za-z]{16}$/, "Expected an event id like evt_0123456789abcdef");

export const SchedulerEventFieldsSchema = z.object({
    locationId: z.string().min(1),
    localDate: LocalDateSchema,
    startLocal: LocalTimeSchema,
    endLocal: LocalTimeSchema,
    name: z.string().trim().min(1, "Name the event").max(120),
    notes: NoteSchema.optional(),
});

export const SchedulerEventPatchSchema = z.object({
    name: z.string().trim().min(1).max(120).optional(),
    localDate: LocalDateSchema.optional(),
    startLocal: LocalTimeSchema.optional(),
    endLocal: LocalTimeSchema.optional(),
    notes: NoteSchema.optional(),
}).strict();

export const SchedulerChangeSchema = z.discriminatedUnion("op", [
    z.object({
        op: z.literal("create"),
        shiftId: NewShiftIdSchema,
        shift: SchedulerShiftFieldsSchema,
        assignees: z.array(SchedulerPersonRefSchema).default([]),
    }),
    z.object({ op: z.literal("update"), shiftId: z.string().min(1), patch: SchedulerShiftPatchSchema }),
    /** A draft is deleted; a published shift is staged for removal until the week is published. */
    z.object({ op: z.literal("delete"), shiftId: z.string().min(1) }),
    /** Sets exactly who is on the shift. On a published shift the difference is staged. */
    z.object({ op: z.literal("assign"), shiftId: z.string().min(1), assignees: z.array(SchedulerPersonRefSchema) }),
    /** An event is a label and a time; its staffing is the shifts that point at it. */
    z.object({ op: z.literal("createEvent"), eventId: NewEventIdSchema, event: SchedulerEventFieldsSchema }),
    z.object({ op: z.literal("updateEvent"), eventId: z.string().min(1), patch: SchedulerEventPatchSchema }),
    /** Its shifts stay and stop pointing at it; delete them in the same batch to remove them too. */
    z.object({ op: z.literal("deleteEvent"), eventId: z.string().min(1) }),
]);

export const SchedulerChangesInputSchema = z.object({
    changes: z.array(SchedulerChangeSchema).min(1).max(300),
    /** Save even if someone would be double-booked or on approved time off. Audited. */
    force: z.boolean().default(false),
});

export const SchedulerBlockingConflictSchema = z.object({
    shiftId: z.string(),
    personId: z.string(),
    personName: z.string(),
    messages: z.array(z.string()),
});

export const SchedulerChangesResultSchema = z.object({
    /** Apply these, in order, to undo the batch. */
    undo: z.array(SchedulerChangeSchema),
    /** Blocking conflicts saved anyway because `force` was set. */
    overridden: z.array(SchedulerBlockingConflictSchema),
});

export const SchedulerWeekScopeSchema = z.object({
    locationId: z.string().min(1),
    /** Any date in the week. */
    weekStart: LocalDateSchema,
});

export const SchedulerDiscardResultSchema = z.object({
    deletedDrafts: z.number().int(),
    revertedShifts: z.number().int(),
    revertedAssignments: z.number().int(),
});

export const SchedulerTemplateSchema = z.object({
    id: z.string(),
    name: z.string(),
    locationId: z.string(),
    startTime: LocalTimeSchema,
    endTime: LocalTimeSchema,
    positions: z.array(z.object({ roleName: z.string(), headcount: z.number().int() })),
    headcount: z.number().int(),
});

export const SchedulerPublishInputSchema = SchedulerWeekScopeSchema.extend({
    /** Publish even with double-bookings or approved time off still in the week. Audited. */
    force: z.boolean().default(false),
});

export const SchedulerPublishPersonSchema = z.object({
    personId: z.string(),
    kind: AssignedWorkerKindSchema,
    name: z.string(),
    added: z.number().int(),
    changed: z.number().int(),
    removed: z.number().int(),
});

/** What publishing this week at this location would do, and to whom. */
export const SchedulerPublishPreviewSchema = z.object({
    newShifts: z.number().int(),
    changedShifts: z.number().int(),
    removedShifts: z.number().int(),
    /** App users who get one message each about their own changes. */
    notify: z.array(SchedulerPublishPersonSchema),
    /** Invited and agency people have no app to reach; the manager tells them. */
    unreachable: z.array(SchedulerPublishPersonSchema),
    /** Open spots staff can see (and, later, claim) once published. */
    openSlots: z.number().int(),
    conflicts: z.array(SchedulerBlockingConflictSchema),
    /** Drafts that already ended; they stay drafts. */
    expiredDrafts: z.number().int(),
});

export const SchedulerPublishResultSchema = SchedulerPublishPreviewSchema.extend({
    publishedAt: z.string().datetime(),
});

export type SchedulerPublishPerson = z.infer<typeof SchedulerPublishPersonSchema>;
export type SchedulerPublishPreview = z.infer<typeof SchedulerPublishPreviewSchema>;
export type SchedulerPublishResult = z.infer<typeof SchedulerPublishResultSchema>;
export type SchedulerPersonRef = z.infer<typeof SchedulerPersonRefSchema>;
export type SchedulerShiftFields = z.input<typeof SchedulerShiftFieldsSchema>;
export type SchedulerShiftPatch = z.infer<typeof SchedulerShiftPatchSchema>;
export type SchedulerEventFields = z.infer<typeof SchedulerEventFieldsSchema>;
export type SchedulerEventPatch = z.infer<typeof SchedulerEventPatchSchema>;
export type SchedulerChange = z.input<typeof SchedulerChangeSchema>;
export type SchedulerChangesInput = z.input<typeof SchedulerChangesInputSchema>;
export type SchedulerBlockingConflict = z.infer<typeof SchedulerBlockingConflictSchema>;
export type SchedulerChangesResult = z.input<typeof SchedulerChangesResultSchema>;
export type SchedulerDiscardResult = z.infer<typeof SchedulerDiscardResultSchema>;
export type SchedulerTemplate = z.infer<typeof SchedulerTemplateSchema>;

// ---------------------------------------------------------------------------
// Setup: the three onboarding answers, the settings they seed, departments
// ---------------------------------------------------------------------------

export const WeekdaySchema = z.number().int().min(0).max(6);

const nonEmpty = (value: object) => Object.keys(value).length > 0;

export const DepartmentNameSchema = z.string().trim().min(1, "Name the department").max(60);
export const DepartmentRolesSchema = z.array(z.string().trim().min(1).max(60)).max(40);

export const SchedulingDepartmentSchema = SchedulerDepartmentSchema.extend({
    sortOrder: z.number().int(),
});

export const SchedulingSettingsSchema = z.object({
    /** Null until the owner answers the setup questions. */
    businessType: BusinessTypeSchema.nullable(),
    scheduleStyle: ScheduleStyleSchema,
    openShiftClaimPolicy: OpenShiftClaimPolicySchema,
    swapApprovalRequired: z.boolean(),
    weekStartsOn: WeekdaySchema,
    overtimePolicy: OvertimePolicySchema,
    departments: z.array(SchedulingDepartmentSchema),
});

/** The onboarding step's three answers. */
export const SchedulingSetupInputSchema = z.object({
    businessType: BusinessTypeSchema,
    scheduleStyle: ScheduleStyleSchema,
    openShiftClaimPolicy: OpenShiftClaimPolicySchema,
}).strict();

export const UpdateSchedulingSettingsSchema = z.object({
    businessType: BusinessTypeSchema.optional(),
    scheduleStyle: ScheduleStyleSchema.optional(),
    openShiftClaimPolicy: OpenShiftClaimPolicySchema.optional(),
    swapApprovalRequired: z.boolean().optional(),
    weekStartsOn: WeekdaySchema.optional(),
    overtimePolicy: OvertimePolicySchema.optional(),
}).strict().refine(nonEmpty, { message: "Change at least one setting." });

export const DepartmentInputSchema = z.object({
    name: DepartmentNameSchema,
    roles: DepartmentRolesSchema.default([]),
}).strict();

export const DepartmentUpdateSchema = z.object({
    name: DepartmentNameSchema.optional(),
    roles: DepartmentRolesSchema.optional(),
    sortOrder: z.number().int().min(0).optional(),
}).strict().refine(nonEmpty, { message: "Change at least one field." });

export const DepartmentIdParamSchema = z.object({ id: z.string().min(1) });

export interface BusinessTypePreset {
    label: string;
    /** One line under the choice: what picking it sets up. */
    summary: string;
    /**
     * Starter departments. Roles use the canonical spelling
     * (canonicalizeWorkerRole) so they match the roster without translation.
     * A department with no roles takes everyone no other department claims.
     */
    departments: { name: string; roles: string[] }[];
}

export const BUSINESS_TYPE_PRESETS: Record<z.infer<typeof BusinessTypeSchema>, BusinessTypePreset> = {
    restaurant: {
        label: "Restaurant or bar",
        summary: "Front of house and Kitchen, with servers, hosts, bartenders and cooks.",
        departments: [
            { name: "Front of house", roles: ["Server", "Host", "Bartender", "Busser"] },
            { name: "Kitchen", roles: ["Line Cook", "Prep Cook", "Dishwasher"] },
        ],
    },
    retail: {
        label: "Retail store",
        summary: "Sales floor, Stock and Leads, with cashiers and associates.",
        departments: [
            { name: "Sales floor", roles: ["Cashier", "Sales Associate"] },
            { name: "Stock", roles: ["Stock Associate"] },
            { name: "Leads", roles: ["Shift Lead"] },
        ],
    },
    events: {
        label: "Events & catering",
        summary: "Service, Kitchen and Setup crews staffed around each booking.",
        departments: [
            { name: "Service", roles: ["Server", "Bartender"] },
            { name: "Kitchen", roles: ["Cook", "Prep Cook"] },
            { name: "Setup", roles: ["Setup Crew"] },
        ],
    },
    other: {
        label: "Something else",
        summary: "One Team to start. Add departments whenever you need them.",
        departments: [{ name: "Team", roles: [] }],
    },
};

export const SCHEDULE_STYLE_OPTIONS: Record<z.infer<typeof ScheduleStyleSchema>, { label: string; summary: string }> = {
    steady: {
        label: "Mostly the same every week",
        summary: "Schedule by person, and start a new week by copying the last one.",
    },
    events: {
        label: "It changes around events and bookings",
        summary: "Schedule by position, with events one click away.",
    },
};

export const OPEN_SHIFT_CLAIM_OPTIONS: Record<z.infer<typeof OpenShiftClaimPolicySchema>, { label: string; summary: string }> = {
    approval: {
        label: "I approve it first",
        summary: "Claims wait in your requests until you say yes.",
    },
    auto: {
        label: "First to claim gets it",
        summary: "The shift is theirs straight away. You can still change it.",
    },
};

/** What "Skip for now" picks. */
export const DEFAULT_SCHEDULING_SETUP: z.infer<typeof SchedulingSetupInputSchema> = {
    businessType: "restaurant",
    scheduleStyle: "steady",
    openShiftClaimPolicy: "approval",
};

export type SchedulingDepartment = z.infer<typeof SchedulingDepartmentSchema>;
export type SchedulingSettings = z.infer<typeof SchedulingSettingsSchema>;
export type SchedulingSetupInput = z.infer<typeof SchedulingSetupInputSchema>;
export type UpdateSchedulingSettings = z.infer<typeof UpdateSchedulingSettingsSchema>;
export type DepartmentInput = z.input<typeof DepartmentInputSchema>;
export type DepartmentUpdate = z.infer<typeof DepartmentUpdateSchema>;

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
