import { z } from "zod";
import { LocalDateSchema, OpenShiftClaimPolicySchema } from "./scheduler";

/**
 * Requests: what workers ask for from the app (pick up an open shift, drop
 * one, hand one to a coworker, take time off) and what managers approve or
 * decline from the Scheduler.
 *
 * Shift requests have `req_` ids and time off has `tor_` ids, so one
 * approve/decline endpoint serves both.
 */

export const ShiftRequestTypeSchema = z.enum(["claim", "drop", "swap"]);
export const RequestKindSchema = z.enum(["claim", "drop", "swap", "time_off"]);
export const ShiftRequestStatusSchema = z.enum(["pending_peer", "pending_manager", "approved", "declined", "cancelled", "expired"]);
export const TimeOffStatusSchema = z.enum(["pending", "approved", "declined", "cancelled"]);
export const RequestStatusSchema = z.enum(["pending_peer", "pending_manager", "pending", "approved", "declined", "cancelled", "expired"]);

const IsoInstantSchema = z.string().datetime({ offset: true });
const NoteSchema = z.string().trim().max(500);

/** Enough of a shift to recognise it without opening it. */
export const RequestShiftSchema = z.object({
    id: z.string(),
    role: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    /** IANA zone the shift's times are read in. */
    timezone: z.string(),
    locationId: z.string().nullable(),
    locationName: z.string().nullable(),
    eventName: z.string().nullable(),
});

export const RequestPersonSchema = z.object({ id: z.string(), name: z.string() });
export const RequestOrganizationSchema = z.object({ id: z.string(), name: z.string() });

export const TimeOffWindowSchema = z.object({
    startTime: z.string(),
    endTime: z.string(),
    allDay: z.boolean(),
    timezone: z.string(),
});

// ---------------------------------------------------------------------------
// Worker side
// ---------------------------------------------------------------------------

export const OpenShiftSchema = z.object({
    shift: RequestShiftSchema,
    organization: RequestOrganizationSchema,
    openSlots: z.number().int().positive(),
    breakMinutes: z.number().int().nonnegative(),
    note: z.string().nullable(),
    /** "auto": claiming puts you on it now. "approval": a manager says yes first. */
    claimPolicy: OpenShiftClaimPolicySchema,
    /** Why you can't take it as things stand ("You're working 4p–11p at Cafe Uno"). */
    conflict: z.string().nullable(),
    /** Your claim on it that is still waiting, if you asked already. */
    pendingRequestId: z.string().nullable(),
});

export const OpenShiftsResponseSchema = z.object({ shifts: z.array(OpenShiftSchema) });

export const WorkerShiftRequestInputSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("claim"), shiftId: z.string().min(1), note: NoteSchema.optional() }),
    z.object({ type: z.literal("drop"), shiftId: z.string().min(1), note: NoteSchema.optional() }),
    z.object({ type: z.literal("swap"), shiftId: z.string().min(1), targetWorkerId: z.string().min(1), note: NoteSchema.optional() }),
]);

export const WorkerRequestResultSchema = z.object({
    id: z.string(),
    status: RequestStatusSchema,
    /** One line for the app to show ("You're on it", "Sent to your manager"). */
    message: z.string(),
});

export const TimeOffInputSchema = z
    .object({
        allDay: z.boolean(),
        /** All-day requests: first and last day off, inclusive, in the workplace's timezone. */
        startDate: LocalDateSchema.optional(),
        endDate: LocalDateSchema.optional(),
        /** Part-day requests: exact instants. */
        startTime: IsoInstantSchema.optional(),
        endTime: IsoInstantSchema.optional(),
        reason: NoteSchema.optional(),
        /** Which workplaces to ask; every one you work for when left out. */
        organizationIds: z.array(z.string().min(1)).min(1).max(20).optional(),
    })
    .superRefine((value, ctx) => {
        if (value.allDay) {
            if (!value.startDate || !value.endDate) {
                ctx.addIssue({ code: "custom", message: "Pick the first and last day off", path: ["startDate"] });
            } else if (value.endDate < value.startDate) {
                ctx.addIssue({ code: "custom", message: "The last day is before the first", path: ["endDate"] });
            }
        } else if (!value.startTime || !value.endTime) {
            ctx.addIssue({ code: "custom", message: "Pick a start and end time", path: ["startTime"] });
        } else if (new Date(value.endTime) <= new Date(value.startTime)) {
            ctx.addIssue({ code: "custom", message: "The end is before the start", path: ["endTime"] });
        }
    });

export const WorkerRequestSchema = z.object({
    id: z.string(),
    kind: RequestKindSchema,
    status: RequestStatusSchema,
    /** "sent": you asked. "received": a coworker offered you their shift. */
    direction: z.enum(["sent", "received"]),
    organization: RequestOrganizationSchema,
    shift: RequestShiftSchema.nullable(),
    timeOff: TimeOffWindowSchema.nullable(),
    /** Swaps: the coworker on the other end. */
    otherPerson: RequestPersonSchema.nullable(),
    note: z.string().nullable(),
    managerNote: z.string().nullable(),
    createdAt: z.string(),
    decidedAt: z.string().nullable(),
    canCancel: z.boolean(),
    canRespond: z.boolean(),
});

export const WorkerRequestsResponseSchema = z.object({ requests: z.array(WorkerRequestSchema) });

export const WorkerRequestActionSchema = z.enum(["accept", "decline", "cancel"]);

export const SwapCandidatesResponseSchema = z.object({
    people: z.array(RequestPersonSchema.extend({ conflict: z.string().nullable() })),
});

export const TimeOffCreatedSchema = z.object({ ids: z.array(z.string()), message: z.string() });

// ---------------------------------------------------------------------------
// Manager side
// ---------------------------------------------------------------------------

export const ManagerRequestsQuerySchema = z.object({
    /** "pending": waiting on a manager. "recent": decided in the last two weeks. */
    view: z.enum(["pending", "recent"]).default("pending"),
});

export const ManagerRequestSchema = z.object({
    id: z.string(),
    kind: RequestKindSchema,
    status: RequestStatusSchema,
    createdAt: z.string(),
    requester: RequestPersonSchema,
    /** Swaps: who would take the shift. */
    target: RequestPersonSchema.nullable(),
    shift: RequestShiftSchema.nullable(),
    timeOff: TimeOffWindowSchema.nullable(),
    note: z.string().nullable(),
    managerNote: z.string().nullable(),
    /** What approving does, in plain words ("Opens 1 Server spot Tue"). */
    impact: z.array(z.string()),
    /** Reasons approving needs "Approve anyway" (double-booked, on time off). */
    conflicts: z.array(z.string()),
    decidedAt: z.string().nullable(),
    decidedByName: z.string().nullable(),
});

export const ManagerRequestsResponseSchema = z.object({
    requests: z.array(ManagerRequestSchema),
    pendingCount: z.number().int().nonnegative(),
});

export const RequestsSummarySchema = z.object({ pending: z.number().int().nonnegative() });

export const RequestIdParamSchema = z.object({ id: z.string().regex(/^(req|tor)_[0-9A-Za-z]+$/, "Unknown request") });

export const DecideRequestInputSchema = z.object({
    note: NoteSchema.optional(),
    /** Approve even though the person is double-booked or on time off (audited). */
    force: z.boolean().default(false),
});

export const DecideRequestResultSchema = z.object({ id: z.string(), status: RequestStatusSchema });

export type ShiftRequestType = z.infer<typeof ShiftRequestTypeSchema>;
export type RequestKind = z.infer<typeof RequestKindSchema>;
export type RequestStatus = z.infer<typeof RequestStatusSchema>;
export type RequestShift = z.infer<typeof RequestShiftSchema>;
export type OpenShift = z.infer<typeof OpenShiftSchema>;
export type OpenShiftsResponse = z.infer<typeof OpenShiftsResponseSchema>;
export type WorkerShiftRequestInput = z.infer<typeof WorkerShiftRequestInputSchema>;
export type WorkerRequestResult = z.infer<typeof WorkerRequestResultSchema>;
export type TimeOffInput = z.infer<typeof TimeOffInputSchema>;
export type WorkerRequest = z.infer<typeof WorkerRequestSchema>;
export type WorkerRequestsResponse = z.infer<typeof WorkerRequestsResponseSchema>;
export type WorkerRequestAction = z.infer<typeof WorkerRequestActionSchema>;
export type SwapCandidatesResponse = z.infer<typeof SwapCandidatesResponseSchema>;
export type TimeOffCreated = z.infer<typeof TimeOffCreatedSchema>;
export type ManagerRequest = z.infer<typeof ManagerRequestSchema>;
export type ManagerRequestsResponse = z.infer<typeof ManagerRequestsResponseSchema>;
export type RequestsSummary = z.infer<typeof RequestsSummarySchema>;
export type DecideRequestInput = z.input<typeof DecideRequestInputSchema>;
export type DecideRequestResult = z.infer<typeof DecideRequestResultSchema>;
