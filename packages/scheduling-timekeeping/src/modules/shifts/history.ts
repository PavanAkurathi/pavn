// packages/scheduling-timekeeping/src/modules/shifts/history.ts

import { db } from "@repo/database";
import { shift } from "@repo/database/schema";
import { inArray, desc, and, eq, lte, or } from "drizzle-orm";
import { mapShiftToDto } from "../../utils/mapper";
import { reconcileOverdueShiftState } from "../time-tracking/reconcile-overdue-shifts";

export const getHistoryShifts = async (orgId: string, pagination: { limit: number, offset: number }) => {
    const { limit, offset } = pagination;
    const now = new Date();

    await reconcileOverdueShiftState(orgId, now);

    const results = await db.query.shift.findMany({
        where: and(
            eq(shift.organizationId, orgId),
            or(
                inArray(shift.status, ['approved', 'cancelled', 'completed']),
                and(
                    inArray(shift.status, ['published', 'assigned', 'in-progress']),
                    lte(shift.endTime, now),
                ),
            ),
        ),
        orderBy: [desc(shift.startTime)], // Newest First
        limit: limit,
        offset: offset,
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

    const dtos = results.map((s) => ({
        ...mapShiftToDto(s),
        is_urgent: false,
        ui_category: 'history',
    }));

    return dtos;
};
