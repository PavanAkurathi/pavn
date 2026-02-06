
import { db } from "@repo/database";
import { shiftAssignment, shift } from "@repo/database/schema";
import { eq, and, ne, lte, gte, or } from "drizzle-orm";

export class OverlapService {
    static async findOverlappingAssignment(
        userId: string,
        startTime: Date,
        endTime: Date,
        excludeAssignmentId?: string
    ) {
        // Query ALL assignments for this user across ALL organizations
        // This is crucial for preventing double-booking across gigs

        const overlaps = await db.query.shiftAssignment.findMany({
            where: and(
                eq(shiftAssignment.workerId, userId),
                ne(shiftAssignment.status, 'cancelled'),
                excludeAssignmentId ? ne(shiftAssignment.id, excludeAssignmentId) : undefined
            ),
            with: {
                shift: {
                    columns: {
                        startTime: true,
                        endTime: true,
                        organizationId: true
                    }
                }
            }
        });

        const conflicting = overlaps.find(a => {
            if (!a.shift) return false;
            // Check time overlap
            return (
                (a.shift.startTime <= endTime) &&
                (a.shift.endTime >= startTime)
            );
        });

        if (conflicting && conflicting.shift) {
            // Privacy Masking: Check if it's the same organization
            // We assume the caller knows their own orgId, but here we return a generic response
            // The caller (Controller) should compare orgId to determine if they can show details

            return {
                conflict: true,
                organizationId: conflicting.shift.organizationId, // Caller handles masking
                type: 'external_busy',
                message: 'Worker is unavailable'
            };
        }

        return { conflict: false };
    }
}
