// packages/shifts/src/modules/shifts/duplicate-shift.ts

import { db } from "@repo/database";
import { shift } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";
import { AppError } from "@repo/observability";

const DuplicateShiftSchema = z.object({
    newStartTime: z.string().datetime(),
    newEndTime: z.string().datetime(),
});

export const duplicateShift = async (
    shiftId: string,
    orgId: string,
    data: unknown
) => {
    const parseResult = DuplicateShiftSchema.safeParse(data);
    if (!parseResult.success) {
        throw new AppError("Invalid input", "VALIDATION_ERROR", 400, parseResult.error.flatten());
    }

    const { newStartTime, newEndTime } = parseResult.data;

    // 1. Fetch source shift
    const source = await db.query.shift.findFirst({
        where: and(eq(shift.id, shiftId), eq(shift.organizationId, orgId)),
    });

    if (!source) {
        throw new AppError("Source shift not found", "SHIFT_NOT_FOUND", 404);
    }

    // 2. Validate times
    if (new Date(newEndTime) <= new Date(newStartTime)) {
        throw new AppError("End time must be after start time", "VALIDATION_ERROR", 400);
    }

    // 3. Create new shift as draft
    const newId = nanoid();
    const now = new Date();

    const [newShift] = await db.insert(shift).values({
        id: newId,
        organizationId: orgId,
        locationId: source.locationId,
        contactId: source.contactId,
        title: source.title,
        description: source.description,
        startTime: new Date(newStartTime),
        endTime: new Date(newEndTime),
        capacityTotal: source.capacityTotal,
        status: "draft",
        createdAt: now,
        updatedAt: now,
    }).returning();

    return {
        success: true,
        shift: newShift,
        sourceShiftId: shiftId,
    };
};
