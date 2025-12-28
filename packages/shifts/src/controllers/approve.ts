// packages/shifts/src/controllers/approve.ts

import { db } from "@repo/database";
import { shift } from "@repo/database/schema";
import { eq } from "drizzle-orm";
import { mapShiftToDto } from "../utils/mapper";

export const approveShiftController = async (shiftId: string): Promise<Response> => {
    // Update the record
    const updated = await db.update(shift)
        .set({ status: 'approved' })
        .where(eq(shift.id, shiftId))
        .returning();

    if (updated.length === 0) {
        return new Response(JSON.stringify({ error: "Shift not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" }
        });
    }

    // Determine the single updated item, but we need to fetch its relations to map it fully if we want to return the full object
    // For now, simpler to just return what we have, or re-fetch.
    // Let's re-fetch to be consistent with other endpoints
    const fullShift = await db.query.shift.findFirst({
        where: eq(shift.id, shiftId),
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

    if (!fullShift) return new Response("Error fetching updated shift", { status: 500 });

    return Response.json(mapShiftToDto(fullShift), { status: 200 });
};
