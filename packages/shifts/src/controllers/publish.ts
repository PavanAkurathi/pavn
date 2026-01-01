import { db } from "@repo/database";
import { shift, shiftAssignment } from "@repo/database/schema";
import { addMinutes } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { newId } from "../utils/ids";

import { z } from "zod";

const PublishSchema = z.object({
    locationId: z.string(),
    contactId: z.string().optional(),
    organizationId: z.string(),
    timezone: z.string(),
    schedules: z.array(z.object({
        startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:MM)"),
        endTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:MM)"),
        dates: z.array(z.string()).max(31, "Cannot publish more than 31 days at once"),
        scheduleName: z.string(),
        positions: z.array(z.object({
            roleName: z.string(),
            price: z.number().optional(),
            workerIds: z.array(z.string().nullable()).max(50, "Cannot exceed 50 positions per role")
        }))
    }))
});

export const publishScheduleController = async (req: Request, headerOrgId: string): Promise<Response> => {
    try {
        const body = await req.json();
        const parseResult = PublishSchema.safeParse(body);

        if (!parseResult.success) {
            return Response.json({
                error: "Validation Failed",
                details: parseResult.error.flatten()
            }, { status: 400 });
        }

        const { locationId, contactId, organizationId, timezone, schedules } = parseResult.data;

        // Security Check: Header vs Body
        if (organizationId && organizationId !== headerOrgId) {
            return Response.json({ error: "Organization mismatch" }, { status: 403 });
        }
        // Force use of header-derived orgId
        const activeOrgId = headerOrgId;

        // 1. Prepare Data in Memory (Batch Strategy)
        const shiftsToInsert: typeof shift.$inferInsert[] = [];
        const assignmentsToInsert: typeof shiftAssignment.$inferInsert[] = [];

        // LOOP A: Iterate through Schedule Blocks
        for (const block of schedules) {

            // GROUPING: Generate a Layout Intent ID for this block ("Batch Context")
            const scheduleIntentId = newId('int');

            // LOOP B: Iterate through Dates
            for (const dateStr of block.dates) {

                // TIMEZONE FIX: Convert Local Wall Time -> UTC Timestamp
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
                        // SMART ID: Use 'shf' prefix
                        const shiftId = newId('shf');
                        // Handle null workerId (Open Spot)
                        const initialStatus = workerId ? 'assigned' : 'published';

                        shiftsToInsert.push({
                            id: shiftId,
                            organizationId: activeOrgId, // Use secure orgId
                            locationId,
                            contactId, // Persist Onsite Manager
                            title: position.roleName,
                            description: block.scheduleName,
                            startTime: startDateTime,
                            endTime: endDateTime,
                            price: position.price || 0,
                            capacityTotal: 1,
                            status: initialStatus,
                            // PERSIST GROUPING
                            scheduleGroupId: scheduleIntentId
                        });

                        if (workerId) {
                            assignmentsToInsert.push({
                                // SMART ID: Use 'asg' prefix
                                id: newId('asg'),
                                shiftId: shiftId,
                                workerId: workerId,
                                status: 'active'
                            });
                        }
                    }
                }
            }
        }

        // 2. Execute Batch Inserts (Atomic Transaction)
        await db.transaction(async (tx) => {
            if (shiftsToInsert.length > 0) {
                await tx.insert(shift).values(shiftsToInsert);
            }

            if (assignmentsToInsert.length > 0) {
                await tx.insert(shiftAssignment).values(assignmentsToInsert);
            }
        });

        return Response.json({
            success: true,
            count: shiftsToInsert.length,
            message: `Successfully published ${shiftsToInsert.length} shifts.`
        }, { status: 201 });

    } catch (error) {
        console.error("Publish Error:", error);
        return Response.json({
            error: "Failed to publish schedule",
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
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
