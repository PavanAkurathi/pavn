// packages/shifts/src/controllers/pending.ts

import { db } from "@repo/database";
import { shift } from "@repo/database/schema";
import { or, eq, and, inArray, lt, asc } from "drizzle-orm";
import { mapShiftToDto } from "../utils/mapper";

export const getPendingShifts = async (orgId: string): Promise<Response> => {
    const now = Date.now();
    const twoHoursMs = 2 * 60 * 60 * 1000;
    const sixHoursMs = 6 * 60 * 60 * 1000;
    const twoHoursAgo = new Date(now - twoHoursMs);

    // 1. Fetch Candidates (Over-fetch logic)
    // We fetch ALL incomplete shifts that ended more than 2 hours ago.
    // This is the "minimum" buffer. We'll refine this list in memory.
    const results = await db.query.shift.findMany({
        where: and(
            eq(shift.organizationId, orgId),
            or(
                // Condition A: Explicitly Completed (Always included)
                eq(shift.status, 'completed'),

                // Condition B: Potential Ghost Shifts (Late > 2h)
                and(
                    inArray(shift.status, ['assigned', 'in-progress']),
                    lt(shift.endTime, twoHoursAgo)
                )
            )
        ),
        orderBy: [asc(shift.startTime)], // Oldest first
        with: {
            organization: true,
            location: true,
            assignments: {
                with: {
                    worker: true
                }
            }
        }
    });

    // 2. Refine Candidates (Dynamic Buffer)
    const refinedResults = results.filter(s => {
        // Always include completed shifts
        if (s.status === 'completed') return true;

        // For ghost shifts, check dynamic buffer
        const start = new Date(s.startTime).getTime();
        const end = new Date(s.endTime).getTime();
        const durationMs = end - start;

        // WH-114: Dynamic Buffer Logic
        // Buffer = Max(2h, Min(6h, 25% of duration))
        const dynamicBufferMs = Math.max(
            twoHoursMs,
            Math.min(sixHoursMs, durationMs * 0.25)
        );

        const thresholdTime = now - dynamicBufferMs;
        return end < thresholdTime;
    });

    const dtos = refinedResults.map(s => ({
        ...mapShiftToDto(s),
        is_urgent: true,
        ui_category: 'action_required'
    }));

    return Response.json(dtos, { status: 200 });
};
