import { z } from "zod";

const NorthAmericaPhoneNumberSchema = z
    .string()
    .refine(
        (value) =>
            /^\s*\+?1?\s*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\s*$/.test(value),
        "Must be a valid US/Canada phone number",
    );

export const WorkerSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    image: z.string().optional().nullable(),
    role: z.string().optional(),
    status: z.string().optional(),
});

export const CrewMemberSchema = z.object({
    id: z.string(),
    memberId: z.string().optional(),
    name: z.string(),
    email: z.string().email(),
    image: z.string().optional().nullable(),
    avatar: z.string().optional().nullable(),
    role: z.string().optional(),
    roles: z.array(z.string()).optional(),
    jobTitle: z.string().optional().nullable(),
    status: z.string().optional(),
    initials: z.string().optional(),
    hours: z.number().optional(),
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
    email: z.boolean(),
    sms: z.boolean(),
});

export const WorkerInviteInputSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phoneNumber: NorthAmericaPhoneNumberSchema.optional(),
    role: z.enum(["admin", "member"]),
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

export const RosterWorkerSchema = z.object({
    id: z.string(),
    role: z.string().nullable().optional(),
    joinedAt: z.string().datetime(),
    jobTitle: z.string().nullable().optional(),
    name: z.string(),
    email: z.string().email(),
    phone: z.string().nullable().optional(),
    image: z.string().nullable().optional(),
    status: z.enum(["active", "invited", "uninvited"]),
    hourlyRate: z.number().nullable().optional(),
    emergencyContact: EmergencyContactSchema.nullable().optional(),
});

export const RosterWorkersSchema = z.array(RosterWorkerSchema);

export const WorkerProfileRoleSchema = z.object({
    id: z.string(),
    role: z.string(),
    hourlyRate: z.number().nullable().optional(),
    createdAt: z.string().datetime(),
});

export const WorkerProfileSchema = z.object({
    displayData: z.object({
        name: z.string(),
        email: z.string().email(),
        phone: z.string().nullable().optional(),
        image: z.string().nullable().optional(),
        status: z.string(),
        emergencyContact: EmergencyContactSchema.nullable().optional(),
        joinedAt: z.string().datetime(),
        userId: z.string().nullable().optional(),
    }),
    roles: z.array(WorkerProfileRoleSchema),
});

export const BulkImportWorkerSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phoneNumber: z.string().optional(),
    role: z.enum(["admin", "member"]),
    jobTitle: z.string().optional(),
    roles: z.array(z.string().min(1)).optional(),
    image: z.string().optional(),
    emergencyContact: EmergencyContactSchema.optional(),
    certifications: z
        .array(
            z.object({
                name: z.string(),
                issuer: z.string(),
                expiresAt: z.coerce.date(),
            }),
        )
        .optional(),
    hourlyRate: z.number().optional(),
});

export const BulkImportWorkersInputSchema = z.array(BulkImportWorkerSchema);

export const BulkImportWorkersResultSchema = z.object({
    success: z.number(),
    failed: z.number(),
    errors: z.array(z.string()),
});

export const RemoveWorkerByEmailSchema = z.object({
    email: z.string().email(),
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
export type RosterWorker = z.infer<typeof RosterWorkerSchema>;
export type WorkerProfile = z.infer<typeof WorkerProfileSchema>;
export type BulkImportWorker = z.infer<typeof BulkImportWorkerSchema>;
export type BulkImportWorkersInput = z.infer<
    typeof BulkImportWorkersInputSchema
>;
export type BulkImportWorkersResult = z.infer<
    typeof BulkImportWorkersResultSchema
>;
