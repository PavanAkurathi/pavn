import { db } from "@repo/database";
import { shift } from "@repo/database/schema";
import { and, eq, desc } from "drizzle-orm";
import { mapShiftToDto } from "../utils/mapper";

export const getDraftShifts = async (orgId: string) => {
    // 1. Query DB for drafts
    const results = await db.query.shift.findMany({
        where: and(
            eq(shift.organizationId, orgId),
            eq(shift.status, 'draft')
        ),
        orderBy: [desc(shift.startTime)], // Newest drafts first
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

    return dtos;
};
