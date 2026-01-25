// packages/shifts/src/controllers/set-availability.ts

import { db } from "@repo/database";
import { workerAvailability } from "@repo/database/schema";
import { AppError } from "@repo/observability";
import { newId } from "../utils/ids";
import { z } from "zod";
import { and, eq, gte, lte } from "drizzle-orm";

const SetAvailabilitySchema = z.object({
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    type: z.enum(['unavailable', 'preferred']).default('unavailable'),
    reason: z.string().optional()
});

export const setAvailabilityController = async (req: Request, workerId: string): Promise<Response> => {
    const body = await req.json();
    const result = SetAvailabilitySchema.safeParse(body);

    if (!result.success) {
        throw new AppError("Invalid input", "VALIDATION_ERROR", 400, result.error.flatten());
    }

    const { startTime, endTime, type } = result.data;
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (end <= start) {
        throw new AppError("End time must be after start time", "INVALID_TIME_RANGE", 400);
    }

    // Check for overlap within SAME availability type for SAME worker
    // Simplification: We don't merge ranges automatically for V1, we just block exact overlaps or let them pile up (cleaned up later)
    // Better UX: Allow it, just insert.

    const id = newId('avl');

    await db.insert(workerAvailability).values({
        id,
        workerId,
        startTime: start,
        endTime: end,
        type
    });

    return Response.json({
        success: true,
        data: {
            id,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            type
        }
    }, { status: 201 });
};
