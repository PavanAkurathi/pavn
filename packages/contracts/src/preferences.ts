import { z } from "zod";

export const WorkerPreferencesSchema = z.object({
    workerId: z.string(),
    nightBeforeEnabled: z.boolean().default(true),
    sixtyMinEnabled: z.boolean().default(true),
    fifteenMinEnabled: z.boolean().default(true),
    shiftStartEnabled: z.boolean().default(true),
    lateWarningEnabled: z.boolean().default(true),
    geofenceAlertsEnabled: z.boolean().default(true),
    quietHoursEnabled: z.boolean().default(false),
    quietHoursStart: z.string().nullable().optional(),
    quietHoursEnd: z.string().nullable().optional(),
    updatedAt: z.date().or(z.string()).optional(),
});

export const UpdateWorkerPreferencesSchema = z.object({
    nightBeforeEnabled: z.boolean().optional(),
    sixtyMinEnabled: z.boolean().optional(),
    fifteenMinEnabled: z.boolean().optional(),
    shiftStartEnabled: z.boolean().optional(),
    lateWarningEnabled: z.boolean().optional(),
    geofenceAlertsEnabled: z.boolean().optional(),
    quietHoursEnabled: z.boolean().optional(),
    quietHoursStart: z.string().nullable().optional(),
    quietHoursEnd: z.string().nullable().optional(),
});

export const WorkerPreferencesResponseSchema = z.object({
    preferences: WorkerPreferencesSchema,
});

export const ManagerPreferencesSchema = z.object({
    managerId: z.string(),
    clockInAlertsEnabled: z.boolean().default(true),
    clockOutAlertsEnabled: z.boolean().default(true),
    shiftScope: z.enum(["all", "booked_by_me", "onsite_contact"]).default("all"),
    locationScope: z.enum(["all", "selected"]).default("all"),
    updatedAt: z.date().or(z.string()).optional(),
});

export const UpdateManagerPreferencesSchema = z.object({
    clockInAlertsEnabled: z.boolean().optional(),
    clockOutAlertsEnabled: z.boolean().optional(),
    shiftScope: z.enum(["all", "booked_by_me", "onsite_contact"]).optional(),
    locationScope: z.enum(["all", "selected"]).optional(),
});

export const ManagerPreferencesResponseSchema = z.object({
    preferences: ManagerPreferencesSchema,
});

export const SecurityAccountSchema = z.object({
    id: z.string(),
    accountId: z.string(),
    providerId: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

export const SecuritySessionSchema = z.object({
    id: z.string(),
    expiresAt: z.string().datetime(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    ipAddress: z.string().nullable().optional(),
    userAgent: z.string().nullable().optional(),
});

export const SecurityOverviewSchema = z.object({
    accounts: z.array(SecurityAccountSchema),
    sessions: z.array(SecuritySessionSchema),
});

export type WorkerPreferences = z.infer<typeof WorkerPreferencesSchema>;
export type UpdateWorkerPreferences = z.infer<
    typeof UpdateWorkerPreferencesSchema
>;
export type ManagerPreferences = z.infer<typeof ManagerPreferencesSchema>;
export type UpdateManagerPreferences = z.infer<
    typeof UpdateManagerPreferencesSchema
>;
export type SecurityOverview = z.infer<typeof SecurityOverviewSchema>;
