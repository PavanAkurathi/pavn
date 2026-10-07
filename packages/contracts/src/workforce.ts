import { z } from "zod";
import { PhoneNumberSchema } from "./auth";

export const WorkerSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    image: z.string().optional().nullable(),
    role: z.string().optional(),
    status: z.string().optional(),
});

export const WorkerStatusSchema = z.enum(["added", "invited", "active", "inactive"]);
export const EmploymentTypeSchema = z.enum(["staff", "agency"]);

/**
 * A worker as their business sees them. One shape for the schedule pickers and
 * the Team page. `hasAccount` is true once they have signed in to the worker
 * app; until then they can still be scheduled.
 */
export const CrewMemberSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    image: z.string().optional().nullable(),
    avatar: z.string().optional().nullable(),
    role: z.string().optional(),
    roles: z.array(z.string()).optional(),
    jobTitle: z.string().optional().nullable(),
    status: WorkerStatusSchema.optional(),
    initials: z.string().optional(),
    hours: z.number().optional(),
    employmentType: EmploymentTypeSchema.optional(),
    agency: z.string().nullable().optional(),
    /** Reference only: never used to compute pay. */
    hourlyRate: z.number().nullable().optional(),
    hasAccount: z.boolean().optional(),
    invitePending: z.boolean().optional(),
    joinedAt: z.string().datetime().optional(),
});

export const AvailabilitySlotSchema = z.object({
    start: z.string(),
    end: z.string(),
});

export const AvailabilitySchema = z.object({
    date: z.string(),
    slots: z.array(AvailabilitySlotSchema),
    status: z.enum(["available", "unavailable", "partial"]),
});

export const AvailabilityResponseSchema = z.array(AvailabilitySchema);

export const WorkerInvitationMethodsSchema = z.object({
    sms: z.boolean(),
});

/**
 * Add a worker to the business. The phone number is the only way in to the
 * worker app, so it is required to invite them; `invites.sms` says whether to
 * text the invite now or just put them on the list.
 */
export const WorkerInviteInputSchema = z.object({
    name: z.string().min(1),
    phoneNumber: PhoneNumberSchema.optional(),
    email: z.string().email().optional(),
    jobTitle: z.string().optional(),
    roles: z.array(z.string().min(1)).optional(),
    hourlyRate: z.number().optional(),
    invites: WorkerInvitationMethodsSchema,
});

export const BulkWorkerInviteInputSchema = z.array(z.string());

export const ContactSchema = z.object({
    id: z.string(),
    memberId: z.string().optional(),
    userId: z.string(),
    name: z.string(),
    phone: z.string(),
    initials: z.string(),
    role: z.string(),
});

export const ContactsSchema = z.array(ContactSchema);

const EmergencyContactSchema = z.object({
    name: z.string(),
    phone: z.string(),
    relation: z.string().optional(),
});

export const WorkerProfileSchema = z.object({
    displayData: z.object({
        name: z.string(),
        email: z.string().nullable().optional(),
        phone: z.string().nullable().optional(),
        image: z.string().nullable().optional(),
        status: z.string(),
        emergencyContact: EmergencyContactSchema.nullable().optional(),
        joinedAt: z.string().datetime(),
        userId: z.string().nullable().optional(),
        employmentType: EmploymentTypeSchema.optional(),
        agency: z.string().nullable().optional(),
        inviteCode: z.string().nullable().optional(),
        hourlyRate: z.number().nullable().optional(),
        jobTitle: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
    }),
    roles: z.array(z.string()),
});

export const BulkImportWorkerSchema = z.object({
    name: z.string().min(1),
    email: z.string().email().optional(),
    phoneNumber: z.string().optional(),
    jobTitle: z.string().optional(),
    roles: z.array(z.string().min(1)).optional(),
    hourlyRate: z.number().optional(),
});

export const BulkImportWorkersInputSchema = z.array(BulkImportWorkerSchema);

export const BulkImportWorkersResultSchema = z.object({
    success: z.number(),
    failed: z.number(),
    errors: z.array(z.string()),
});

export const ScheduleBootstrapSchema = z.object({
    crew: z.array(CrewMemberSchema),
});

export type Worker = z.infer<typeof WorkerSchema>;
export type CrewMember = z.infer<typeof CrewMemberSchema>;
export type Availability = z.infer<typeof AvailabilitySchema>;
export type AvailabilityResponse = z.infer<typeof AvailabilityResponseSchema>;
export type WorkerInviteInput = z.infer<typeof WorkerInviteInputSchema>;
export type BulkWorkerInviteInput = z.infer<typeof BulkWorkerInviteInputSchema>;
export type Contact = z.infer<typeof ContactSchema>;
export type WorkerProfile = z.infer<typeof WorkerProfileSchema>;
export type BulkImportWorker = z.infer<typeof BulkImportWorkerSchema>;
export type BulkImportWorkersInput = z.infer<
    typeof BulkImportWorkersInputSchema
>;
export type BulkImportWorkersResult = z.infer<
    typeof BulkImportWorkersResultSchema
>;
