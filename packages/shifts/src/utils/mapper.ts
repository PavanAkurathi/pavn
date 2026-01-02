import { Shift as ApiShift } from "../types";
import { getInitials } from "./formatting";
import { shift, location, user, shiftAssignment } from "@repo/database/schema";
import { InferSelectModel } from "drizzle-orm";

// 1. Base Shift Type
type BaseShift = InferSelectModel<typeof shift>;

// 2. Relations (matches the `with: { ... }` in controllers)
interface ShiftWithRelations extends BaseShift {
    location: InferSelectModel<typeof location> | null;
    assignments: Array<
        InferSelectModel<typeof shiftAssignment> & {
            worker: InferSelectModel<typeof user> | null;
        }
    >;
}

export const mapShiftToDto = (dbShift: ShiftWithRelations): ApiShift => {
    // Calculate capacity based on assignments count
    const filled = dbShift.assignments ? dbShift.assignments.length : 0;

    return {
        id: dbShift.id,
        title: dbShift.title,
        description: dbShift.description || undefined,
        locationName: dbShift.location?.name || "Unknown Location", // Fallback if join is missing
        locationId: dbShift.locationId || "unknown",
        locationAddress: dbShift.location?.address || undefined,
        contactId: dbShift.contactId,
        // Convert Date objects to ISO Strings
        startTime: dbShift.startTime.toISOString(),
        endTime: dbShift.endTime.toISOString(),
        status: dbShift.status as ApiShift['status'],
        price: dbShift.price || 0, // Ensure number
        capacity: {
            filled: filled,
            total: dbShift.capacityTotal
        },
        // Map assignments to worker details
        assignedWorkers: dbShift.assignments?.map((a) => ({
            id: a.workerId,
            name: a.worker?.name ?? "Unknown",
            initials: getInitials(a.worker?.name),
            avatarUrl: a.worker?.image || undefined
        })) || []
    };
};
