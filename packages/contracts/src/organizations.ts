import { z } from "zod";
import { AttendanceVerificationPolicySchema } from "./shared";

const NorthAmericaPhoneNumberSchema = z
    .string()
    .refine(
        (value) =>
            /^\s*\+?1?\s*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\s*$/.test(value),
        "Must be a valid US/Canada phone number",
    );

export const LocationSchema = z.object({
    id: z.string(),
    name: z.string(),
    address: z.string().nullable().optional(),
    timezone: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    radius: z.number().optional(),
    parking: z.string().nullable().optional(),
    specifics: z.array(z.string()).optional(),
    instructions: z.string().nullable().optional(),
    geofenceRadius: z.number().nullable().optional(),
});

export const createLocationSchema = z.object({
    name: z.string().min(1).max(200),
    address: z.string().min(5).max(500),
    timezone: z.string().optional().default("UTC"),
    geofenceRadius: z.number().min(50).max(1000).optional().default(150),
    geofenceRadiusMeters: z.number().optional(),
});

export const UpdateOrganizationSettingsSchema = z.object({
    timezone: z.string().optional(),
    earlyClockInBufferMinutes: z.number().int().min(0).max(720).optional(),
    regionalOvertimePolicy: z.enum(["weekly_40", "daily_8"]).optional(),
    attendanceVerificationPolicy: AttendanceVerificationPolicySchema.optional(),
});

export const OrganizationSettingsSchema = z.object({
    name: z.string(),
    slug: z.string().nullable().optional(),
    timezone: z.string(),
    currencyCode: z.string(),
    attendanceVerificationPolicy: AttendanceVerificationPolicySchema,
    excessParameters: z.object({
        earlyClockInBufferMinutes: z.number().int(),
        breakThresholdMinutes: z.number().int().nullable().optional(),
        regionalOvertimePolicy: z.string(),
    }),
});

export const TeamInvitationRoleSchema = z.enum(["admin", "manager"]);

export const InvitationMethodsSchema = z.object({
    email: z.boolean(),
    sms: z.boolean(),
});

export const TeamMemberInvitationInputSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phoneNumber: NorthAmericaPhoneNumberSchema.optional(),
    role: TeamInvitationRoleSchema,
    invites: InvitationMethodsSchema,
});

export const OrganizationSummarySchema = z.object({
    id: z.string(),
    name: z.string(),
    logo: z.string().nullable().optional(),
});

export const OrganizationProfileSchema = z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string().nullable().optional(),
    logo: z.string().nullable().optional(),
    metadata: z.string().nullable().optional(),
    timezone: z.string().nullable().optional(),
    attendanceVerificationPolicy: AttendanceVerificationPolicySchema
        .nullable()
        .optional(),
});

export const OrganizationProfileUpdateSchema = z.object({
    name: z.string().min(2).max(50),
    description: z.string().optional(),
    timezone: z.string().min(1).optional(),
    attendanceVerificationPolicy: AttendanceVerificationPolicySchema.optional(),
    markBusinessInformationComplete: z.boolean().optional(),
});

export const WorkspaceMemberSchema = z.object({
    id: z.string(),
    entryType: z.enum(["member", "invitation"]),
    role: z.string(),
    joinedAt: z.string().datetime(),
    name: z.string(),
    email: z.string().email(),
    image: z.string().nullable().optional(),
    jobTitle: z.string().nullable().optional(),
    status: z.enum(["active", "invited"]).optional(),
    user: z
        .object({
            id: z.string(),
        })
        .optional(),
});

export const OrganizationWorkspaceSchema = z.object({
    organization: OrganizationProfileSchema.nullable(),
    locations: z.array(LocationSchema),
    role: z.string(),
    members: z.array(WorkspaceMemberSchema),
});

export const OrganizationInvitationStateSchema = z.object({
    id: z.string(),
    email: z.string().email(),
    role: TeamInvitationRoleSchema,
    organizationId: z.string(),
    organizationName: z.string(),
    existingUserId: z.string().nullable().optional(),
    existingUserName: z.string().nullable().optional(),
    isExpired: z.boolean(),
});

export const OrganizationDefaultContextSchema = z.object({
    organizationId: z.string().nullable(),
});

export { AttendanceVerificationPolicySchema };

export type Location = z.infer<typeof LocationSchema>;
export type CreateLocationInput = z.input<typeof createLocationSchema>;
export type OrganizationSettings = z.infer<typeof OrganizationSettingsSchema>;
export type UpdateOrganizationSettings = z.infer<
    typeof UpdateOrganizationSettingsSchema
>;
export type TeamInvitationRole = z.infer<typeof TeamInvitationRoleSchema>;
export type TeamMemberInvitationInput = z.infer<
    typeof TeamMemberInvitationInputSchema
>;
export type OrganizationSummary = z.infer<typeof OrganizationSummarySchema>;
export type OrganizationProfile = z.infer<typeof OrganizationProfileSchema>;
export type OrganizationProfileUpdate = z.infer<
    typeof OrganizationProfileUpdateSchema
>;
export type WorkspaceMember = z.infer<typeof WorkspaceMemberSchema>;
export type OrganizationWorkspace = z.infer<
    typeof OrganizationWorkspaceSchema
>;
export type OrganizationInvitationState = z.infer<
    typeof OrganizationInvitationStateSchema
>;
export type OrganizationDefaultContext = z.infer<
    typeof OrganizationDefaultContextSchema
>;
