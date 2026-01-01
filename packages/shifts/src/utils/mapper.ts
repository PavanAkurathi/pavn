// packages/shifts/src/utils/mapper.ts
import { Shift as ApiShift } from "../types";
// Import Drizzle types (or infer them if exported from schema)
// For now, defining a local interface that matches the query result structure
// Ideally, this should come from `typeof db.query.shift.findFirst` result type.
interface DbShift {
    id: string;
    organizationId: string;
    title: string;
    description: string | null;
    locationId: string | null;
    locationName?: string | null;
    startTime: Date;
    endTime: Date;
    price: number | null;
    capacityTotal: number;
    status: "draft" | "published" | "assigned" | "completed" | "approved" | "cancelled";
    location?: {
        name: string;
        address: string | null;
    } | null;
    assignments?: Array<{
        workerId: string;
        worker?: {
            name: string;
            image: string | null;
        } | null;
    }>;
}

export const mapShiftToDto = (dbShift: DbShift): ApiShift => {
    // Calculate capacity based on assignments count
    const filled = dbShift.assignments ? dbShift.assignments.length : 0;

    return {
        id: dbShift.id,
        title: dbShift.title,
        locationName: dbShift.locationName || dbShift.location?.name || "Unknown Location", // Fallback if join is missing
        locationId: dbShift.locationId || "unknown",
        locationAddress: dbShift.location?.address || undefined,
        // Convert Date objects to ISO Strings
        startTime: dbShift.startTime.toISOString(),
        endTime: dbShift.endTime.toISOString(),
        status: dbShift.status,
        price: dbShift.price || 0, // Ensure number
        capacity: {
            filled: filled,
            total: dbShift.capacityTotal
        },
        // Map assignments to worker details
        assignedWorkers: dbShift.assignments?.map((a) => ({
            id: a.workerId,
            name: a.worker?.name ?? "Unknown",
            initials: a.worker?.name ? a.worker.name.substring(0, 2).toUpperCase() : "??",
            avatarUrl: a.worker?.image || undefined
        })) || []
    };
};
