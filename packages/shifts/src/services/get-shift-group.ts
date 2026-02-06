// packages/shifts/src/services/get-shift-group.ts

import { db } from "@repo/database";
import { shift } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { AppError } from "@repo/observability";
import { getInitials } from "../utils/formatting";

export const getShiftGroup = async (groupId: string, orgId: string) => {
    // 1. Fetch all shifts in the group
    const shifts = await db.query.shift.findMany({
        where: and(
            eq(shift.scheduleGroupId, groupId),
            eq(shift.organizationId, orgId)
        ),
        with: {
            assignments: {
                with: {
                    worker: true
                }
            },
            location: true
        }
    });

    if (shifts.length === 0) {
        throw new AppError("Shift Group not found", "GROUP_NOT_FOUND", 404);
    }

    // 2. Aggregate Data
    // We want a structure similar to Instawork:
    // - Group Details (Time, Location, Title based on first shift?)
    // - List of all workers across all roles (Roles are effectively sub-shifts)

    const firstShift = shifts[0]!; // Safe: Checked length invalid above
    const groupDetails = {
        groupId: groupId,
        location: firstShift.location,
        startTime: firstShift.startTime, // Assuming consolidated time for the visual group
        endTime: firstShift.endTime,
        title: firstShift.description || "Shift Group", // Use description (schedule name) as main title
    };

    const workers = shifts.flatMap(s => s.assignments.map(a => ({
        assignmentId: a.id,
        shiftId: s.id,
        roleName: s.title, // "Chef", "Server"
        rate: s.price,     // $50.70
        workerId: a.workerId,
        name: a.worker?.name || "Unknown",
        avatar: a.worker?.image,
        initials: getInitials(a.worker?.name || ""),
        status: a.status,
        clockIn: a.effectiveClockIn || a.actualClockIn,
        clockOut: a.effectiveClockOut || a.actualClockOut,
        isRostered: ['assigned', 'active'].includes(a.status)
    })));

    return {
        group: groupDetails,
        workers: workers,
        shifts: shifts.map(s => ({
            id: s.id,
            role: s.title,
            capacity: s.capacityTotal,
            fillCount: s.assignments.length
        }))
    };
};
