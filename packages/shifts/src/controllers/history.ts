// packages/shifts/src/controllers/history.ts

import { db } from "@repo/database";
import { shift } from "@repo/database/schema";
import { inArray, desc, and, eq } from "drizzle-orm";
import { mapShiftToDto } from "../utils/mapper";

export const getHistoryShifts = async (orgId: string): Promise<Response> => {
    const results = await db.query.shift.findMany({
        where: and(
            eq(shift.organizationId, orgId),
            inArray(shift.status, ['approved', 'cancelled'])
        ),
        orderBy: [desc(shift.startTime)], // Newest First
        limit: 50, // Strict limit for now
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
        is_urgent: false,
        ui_category: 'history'
    }));

    return Response.json(dtos, { status: 200 });
};
