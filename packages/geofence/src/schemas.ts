import { z } from "zod";

export const ClockActionResponseSchema = z.object({
    success: z.boolean(),
    timestamp: z.string().optional(),
    location: z.object({
        latitude: z.number(),
        longitude: z.number(),
    }).optional(),
    message: z.string().optional(),
});

export const CorrectionRequestSchema = z.object({
    id: z.string(),
    userId: z.string(),
    type: z.enum(['clock-in', 'clock-out', 'other']),
    originalTime: z.string().optional(),
    requestedTime: z.string(),
    reason: z.string(),
    status: z.enum(['pending', 'approved', 'rejected']),
    createdAt: z.string(),
});

export const PendingCorrectionsResponseSchema = z.array(CorrectionRequestSchema);
