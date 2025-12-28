// packages/shifts/src/utils/mapper.ts

import { Shift as ApiShift } from "../types";

export const mapShiftToDto = (dbShift: any): ApiShift => {
    // Calculate capacity based on assignments count
    const filled = dbShift.assignments ? dbShift.assignments.length : 0;

    return {
        id: dbShift.id,
        title: dbShift.title,
        locationName: dbShift.locationName || dbShift.location?.name || "Unknown Location", // Fallback if join is missing
        locationId: dbShift.locationId,
        locationAddress: dbShift.location?.address || undefined,
        // Convert Date objects to ISO Strings
        startTime: dbShift.startTime.toISOString(),
        endTime: dbShift.endTime.toISOString(),
        status: dbShift.status as any,
        price: dbShift.price, // It's an integer (cents)
        capacity: {
            filled: filled,
            total: dbShift.capacityTotal
        },
        // Map assignments to worker details
        assignedWorkers: dbShift.assignments?.map((a: any) => ({
            id: a.workerId,
            name: a.worker?.name,
            initials: a.worker?.name ? a.worker.name.substring(0, 2).toUpperCase() : "??",
            avatarUrl: a.worker?.image || undefined
        })) || []
    };
};
