// packages/shifts/src/controllers/get-by-id.ts

import { db } from "@repo/database";
import { shift } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { mapShiftToDto } from "../utils/mapper";

export const getShiftByIdController = async (id: string, orgId: string): Promise<Response> => {
    // 1. Query DB for single shift
    const result = await db.query.shift.findFirst({
        where: and(eq(shift.id, id), eq(shift.organizationId, orgId)),
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

    if (!result) {
        return Response.json({ error: "Shift not found" }, { status: 404 });
    }

    // 2. Map to DTO
    const dto = mapShiftToDto(result);

    return Response.json(dto, { status: 200 });
};
