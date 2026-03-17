import { z } from "zod";

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

export const AvailabilitySchema = z.object({
    date: z.string(),
    slots: z.array(z.object({
        start: z.string(),
        end: z.string(),
    })),
    status: z.enum(["available", "unavailable", "partial"]),
});

export const AvailabilityResponseSchema = z.array(AvailabilitySchema);
