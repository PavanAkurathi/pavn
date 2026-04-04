import { z } from "zod";
import { AttendanceVerificationPolicySchema } from "./shared";

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
    registrationSummary: z.array(z.string()),
    steps: z.array(OnboardingStepSchema),
    deferredSteps: z.array(OnboardingStepSchema),
    completedCount: z.number(),
    totalCount: z.number(),
    isComplete: z.boolean(),
    settingsHref: z.string(),
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
export type OnboardingStatus = z.infer<typeof OnboardingStatusSchema>;
