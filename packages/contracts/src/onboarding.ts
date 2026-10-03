import { z } from "zod";
import { AttendanceVerificationPolicySchema } from "./shared";
import { BusinessTypeSchema, OpenShiftClaimPolicySchema, ScheduleStyleSchema } from "./scheduler";

export const OnboardingStepSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    href: z.string(),
    complete: z.boolean(),
    supportingText: z.string(),
    optional: z.boolean().optional(),
});

export const BusinessOnboardingStateSchema = z.object({
    orgId: z.string(),
    organizationName: z.string(),
    organizationTimezone: z.string(),
    attendanceVerificationPolicy: AttendanceVerificationPolicySchema,
    billingHandled: z.boolean(),
    hasWorkforceAccess: z.boolean(),
    hasPublishedShift: z.boolean(),
    hasDraftShift: z.boolean(),
    /** The "How you schedule" answers so far; businessType is null until answered. */
    scheduling: z.object({
        businessType: BusinessTypeSchema.nullable(),
        scheduleStyle: ScheduleStyleSchema,
        openShiftClaimPolicy: OpenShiftClaimPolicySchema,
    }),
    registrationSummary: z.array(z.string()),
    steps: z.array(OnboardingStepSchema),
    deferredSteps: z.array(OnboardingStepSchema),
    completedCount: z.number(),
    totalCount: z.number(),
    isComplete: z.boolean(),
    settingsHref: z.string(),
});

/**
 * What onboarding needs to know about an organization, as plain facts.
 *
 * The API reads them from the database; the web app turns them into steps and
 * links. Keeping hrefs and copy out of this shape is what lets apps/web stay
 * off the database.
 */
export const OnboardingFactsSchema = z.object({
    orgId: z.string(),
    name: z.string(),
    timezone: z.string().nullable(),
    attendanceVerificationPolicy: z.string().nullable(),
    businessType: BusinessTypeSchema.nullable(),
    scheduleStyle: z.string().nullable(),
    openShiftClaimPolicy: z.string().nullable(),
    /** Raw organization.metadata JSON string; the web app parses it. */
    metadata: z.string().nullable(),
    subscriptionStatus: z.string().nullable(),
    /** The caller's role in this organization. */
    memberRole: z.string(),
    firstLocationName: z.string().nullable(),
    hasLocation: z.boolean(),
    hasPublishedShift: z.boolean(),
    hasDraftShift: z.boolean(),
    hasRosterEntry: z.boolean(),
    hasWorkerMember: z.boolean(),
    hasManagerMember: z.boolean(),
    hasManagerInvite: z.boolean(),
});

export const OnboardingStatusSchema = z.object({
    hasOnboarding: z.boolean(),
    isComplete: z.boolean(),
    memberRole: z.string().nullable().optional(),
    requiresOnboarding: z.boolean(),
});

export type OnboardingStep = z.infer<typeof OnboardingStepSchema>;
export type BusinessOnboardingState = z.infer<
    typeof BusinessOnboardingStateSchema
>;
export type OnboardingFacts = z.infer<typeof OnboardingFactsSchema>;
export type OnboardingStatus = z.infer<typeof OnboardingStatusSchema>;
