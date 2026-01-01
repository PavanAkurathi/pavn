// packages/shifts/src/controllers/upcoming.ts

import { db } from "@repo/database";
import { shift } from "@repo/database/schema";
import { inArray, asc, and, eq } from "drizzle-orm";
import { mapShiftToDto } from "../utils/mapper";

export const getUpcomingShifts = async (orgId: string): Promise<Response> => {
    // 1. Query DB
    const results = await db.query.shift.findMany({
        where: and(
            eq(shift.organizationId, orgId),
            inArray(shift.status, ['published', 'assigned', 'in-progress'])
        ),
        orderBy: [asc(shift.startTime)],
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

    // 2. Map to DTO
    const dtos = results.map(mapShiftToDto);

    return Response.json(dtos, { status: 200 });
};
