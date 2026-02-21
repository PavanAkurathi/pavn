// packages/shifts/src/modules/shifts/open-shifts.ts

import { db } from "@repo/database";
import { shift, shiftAssignment } from "@repo/database/schema";
import { eq, and, gt, sql, count } from "drizzle-orm";
import { mapShiftToDto } from "../../utils/mapper";

export const getOpenShifts = async (orgId: string) => {
    // Shifts that are published/assigned with start time in the future
    const now = new Date();

    const shifts = await db.query.shift.findMany({
        where: and(
            eq(shift.organizationId, orgId),
            gt(shift.startTime, now),
            sql`${shift.status} IN ('published', 'assigned')`
        ),
        with: {
            location: true,
            assignments: {
                where: eq(shiftAssignment.status, "active"),
                columns: { id: true, workerId: true },
                with: {
                    worker: {
                        columns: { id: true, name: true, image: true }
                    }
                }
            }
        },
        orderBy: [shift.startTime],
    });

    // Filter to only those with unfilled capacity
    const openShifts = shifts.filter(s =>
        (s.assignments?.length || 0) < s.capacityTotal
    );

    return openShifts.map(s => ({
        ...mapShiftToDto(s),
        capacityFilled: s.assignments?.length || 0,
        capacityTotal: s.capacityTotal,
        spotsRemaining: s.capacityTotal - (s.assignments?.length || 0),
    }));
};
