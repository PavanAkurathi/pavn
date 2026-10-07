// packages/scheduling-timekeeping/src/modules/shifts/pending.ts

import { db } from "@repo/database";
import { shift } from "@repo/database/schema";
import { or, eq, and, inArray, lte, asc } from "drizzle-orm";
import { mapShiftToDto } from "../../utils/mapper";
import { reconcileOverdueShiftState } from "../time-tracking/reconcile-overdue-shifts";

export const getPendingShifts = async (orgId: string) => {
    const now = new Date();

    await reconcileOverdueShiftState(orgId, now);

    const results = await db.query.shift.findMany({
        where: and(
            eq(shift.organizationId, orgId),
            or(
                eq(shift.status, 'completed'),
                and(
                    inArray(shift.status, ['published', 'assigned', 'in-progress']),
                    lte(shift.endTime, now),
                ),
            ),
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

    const refinedResults = results.filter((record) =>
        (record.assignments ?? []).some((assignment) => assignment.status !== 'removed'),
    );

    const dtos = refinedResults.map((s) => ({
        ...mapShiftToDto(s),
        is_urgent: true,
        ui_category: 'action_required',
    }));

    return dtos;
};
