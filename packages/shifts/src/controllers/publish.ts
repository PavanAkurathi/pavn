// packages/shifts/src/controllers/publish.ts


import { db } from "@repo/database";
import { shift, shiftAssignment } from "@repo/database/schema";
import { addMinutes } from "date-fns";
import { fromZonedTime } from "date-fns-tz";

interface PublishSchedulePayload {
    locationId: string;
    contactId?: string; // Optional if not used yet
    organizationId: string;
    timezone: string; // Required
    schedules: Array<{
        startTime: string; // "09:00"
        endTime: string;   // "17:00"
        dates: string[];   // ["2025-12-30"]
        scheduleName: string;
        positions: Array<{
            roleName: string;
            price?: number;
            workerIds: (string | null)[];
        }>;
    }>;
}

export const publishScheduleController = async (req: Request): Promise<Response> => {
    try {
        const body = (await req.json()) as PublishSchedulePayload;
        const { locationId, organizationId, timezone, schedules } = body;

        // Validation
        if (!timezone) {
            return new Response("Timezone required", { status: 400 });
        }
        if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
            return new Response("Invalid payload", { status: 400 });
        }

        // 1. Prepare Data in Memory (Batch Strategy to avoid Neon HTTP Transaction issues)
        const shiftsToInsert: typeof shift.$inferInsert[] = [];
        const assignmentsToInsert: typeof shiftAssignment.$inferInsert[] = [];

        // LOOP A: Iterate through Schedule Blocks
        for (const block of schedules) {

            // LOOP B: Iterate through Dates
            for (const dateStr of block.dates) {

                // TIMEZONE FIX: Convert Local Wall Time -> UTC Timestamp
                // Date string comes in as ISO (e.g., "2025-01-01T00:00:00.000Z") from frontend date picker or just "YYYY-MM-DD"
                // fromZonedTime handles "YYYY-MM-DDTHH:mm:ss" well.
                // We assume dateStr is "YYYY-MM-DD" or similar.
                const datePart = (dateStr.includes("T") ? dateStr.split("T")[0] : dateStr) || "";

                const startDateTime = combineDateTimeTz(datePart, block.startTime, timezone);
                let endDateTime = combineDateTimeTz(datePart, block.endTime, timezone);

                // Handle Overnight Shifts
                if (endDateTime < startDateTime) {
                    endDateTime = addMinutes(endDateTime, 24 * 60);
                }

                // LOOP C: Iterate through Positions
                for (const position of block.positions) {

                    // LOOP D: Iterate through Worker Slots
                    for (const workerId of position.workerIds) {
                        const shiftId = crypto.randomUUID();
                        // Handle null workerId (Open Spot)
                        const initialStatus = workerId ? 'assigned' : 'published';

                        shiftsToInsert.push({
                            id: shiftId,
                            organizationId: organizationId || "org_default",
                            locationId,
                            title: position.roleName,
                            description: block.scheduleName,
                            startTime: startDateTime,
                            endTime: endDateTime,
                            price: position.price || 0,
                            capacityTotal: 1,
                            status: initialStatus,
                        });

                        if (workerId) {
                            assignmentsToInsert.push({
                                id: crypto.randomUUID(),
                                shiftId: shiftId,
                                workerId: workerId,
                                status: 'active'
                            });
                        }
                    }
                }
            }
        }

        // 2. Execute Batch Inserts
        if (shiftsToInsert.length > 0) {
            await db.insert(shift).values(shiftsToInsert);
        }

        if (assignmentsToInsert.length > 0) {
            await db.insert(shiftAssignment).values(assignmentsToInsert);
        }

        return Response.json({
            success: true,
            count: shiftsToInsert.length,
            message: `Successfully published ${shiftsToInsert.length} shifts.`
        }, { status: 201 });

    } catch (error) {
        console.error("Publish Error:", error);
        return new Response(JSON.stringify({
            error: "Failed to publish schedule",
            details: error instanceof Error ? error.message : String(error)
        }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
};

// --- Helper Utilities ---

function combineDateTimeTz(dateStr: string, timeStr: string, timeZone: string): Date {
    // Construct local ISO string: "2025-12-30T09:00:00"
    // Note: timeStr must be "HH:mm"
    const localIso = `${dateStr}T${timeStr}:00`;
    // Convert to UTC Date object based on the timezone
    return fromZonedTime(localIso, timeZone);
}
