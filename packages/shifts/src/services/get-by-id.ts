// packages/shifts/src/services/get-by-id.ts

import { db } from "@repo/database";
import { shift } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { mapShiftToDto } from "../utils/mapper";
import { AppError } from "@repo/observability";

export const getShiftById = async (id: string, orgId: string) => {
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
        throw new AppError("Shift not found", "SHIFT_NOT_FOUND", 404);
    }

    // 2. Map to DTO
    const dto = mapShiftToDto(result);

    return dto;
};
