// packages/shifts/src/controllers/pending.ts

import { db } from "@repo/database";
import { shift } from "@repo/database/schema";
import { or, eq, and, inArray, lt, asc } from "drizzle-orm";
import { mapShiftToDto } from "../utils/mapper";

export const getPendingShifts = async (orgId: string): Promise<Response> => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const results = await db.query.shift.findMany({
        where: and(
            eq(shift.organizationId, orgId),
            or(
                // Condition A: Explicitly Completed
                eq(shift.status, 'completed'),

                // Condition B: Ghost Shifts (Late)
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

    const dtos = results.map(s => ({
        ...mapShiftToDto(s),
        is_urgent: true,
        ui_category: 'action_required'
    }));

    return Response.json(dtos, { status: 200 });
};
