// packages/shifts/src/controllers/get-by-id.ts

import { db } from "@repo/database";
import { shift } from "@repo/database/schema";
import { eq } from "drizzle-orm";
import { mapShiftToDto } from "../utils/mapper";

export const getShiftByIdController = async (id: string): Promise<Response> => {
    // 1. Query DB for single shift
    const result = await db.query.shift.findFirst({
        where: eq(shift.id, id),
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
        return new Response(JSON.stringify({ error: "Shift not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" }
        });
    }

    // 2. Map to DTO
    const dto = mapShiftToDto(result);

    return Response.json(dto, { status: 200 });
};
