import { Shift as ApiShift } from "../types";
import { getInitials } from "./formatting";
import { shift, location, shiftAssignment, organization, worker } from "@repo/database/schema";
import { InferSelectModel } from "drizzle-orm";
import { DEFAULT_ATTENDANCE_VERIFICATION_POLICY } from "@repo/config";

// 1. Base Shift Type
type BaseShift = InferSelectModel<typeof shift>;

// 2. Relations (matches the `with: { ... }` in controllers)
interface ShiftWithRelations extends BaseShift {
    location: InferSelectModel<typeof location> | null;
    organization?: InferSelectModel<typeof organization> | null;
    assignments: Array<
        InferSelectModel<typeof shiftAssignment> & {
            worker: InferSelectModel<typeof worker> | null;
        }
    >;
}

type AttendanceVerificationPolicy = "strict_geofence" | "soft_geofence" | "none";

export const mapShiftToDto = (dbShift: ShiftWithRelations): ApiShift => {
    const visibleAssignments = (dbShift.assignments ?? []).filter(
        (assignment) => assignment.status !== "removed",
    );
    const filled = visibleAssignments.length;

    return {
        id: dbShift.id,
        title: dbShift.title,
        description: dbShift.description || undefined,
        locationName: dbShift.location?.name || "Unknown Location", // Fallback if join is missing
        locationId: dbShift.locationId || "unknown",
        locationAddress: dbShift.location?.address || undefined,
        geofenceRadius: dbShift.location?.geofenceRadius || 150, // [UX-008] Default to 150m (Consistent with Create)
        attendanceVerificationPolicy:
            (dbShift.organization?.attendanceVerificationPolicy as AttendanceVerificationPolicy | null | undefined)
            || DEFAULT_ATTENDANCE_VERIFICATION_POLICY,
        contactId: dbShift.contactId,
        // Convert Date objects to ISO Strings
        startTime: dbShift.startTime.toISOString(),
        endTime: dbShift.endTime.toISOString(),
        // Prefer the shift's own zone, falling back to where it happens. Only
        // null when neither is set, and the client then has to say so rather
        // than silently using the viewer's clock.
        timezone: dbShift.timezone || dbShift.location?.timezone || undefined,
        createdAt: dbShift.createdAt ? dbShift.createdAt.toISOString() : undefined,
        status: dbShift.status as ApiShift['status'],
        // price: dbShift.price || 0, // REMOVED per TICKET-005
        capacity: {
            filled: filled,
            total: dbShift.capacityTotal
        },
        // Map assignments to worker details
        assignedWorkers: visibleAssignments.map((a) => {
            const name = a.worker?.name ?? "Unknown";
            return {
                id: a.workerId,
                name,
                initials: getInitials(name),
                kind: workerKind(a.worker),
            };
        })
    };
};

/**
 * Agency temps never log in; anyone else is active once they have an account
 * and invited until then (they can still be scheduled).
 */
export const workerKind = (
    w: { employmentType: string; userId: string | null } | null | undefined,
) => (
    w?.employmentType === "agency" ? "agency" as const
        : w?.userId ? "active" as const
            : "invited" as const
);
