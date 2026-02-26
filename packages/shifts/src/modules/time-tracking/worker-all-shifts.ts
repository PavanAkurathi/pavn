// packages/shifts/src/modules/time-tracking/worker-all-shifts.ts

import { db } from "@repo/database";
import { shift, shiftAssignment, location, organization, member } from "@repo/database/schema";
import { eq, and, inArray, gte, lte, asc, desc, ne, sql } from "drizzle-orm";

interface WorkerAllShiftsFilters {
    status: 'upcoming' | 'history' | 'in-progress' | 'all';
    orgId?: string; // optional org filter
    limit?: number;
    offset?: number;
}

interface ConflictInfo {
    shiftId: string;
    overlapsWithShiftId: string;
    overlapsWithTitle: string;
    overlapsWithOrg: string;
    overlapStart: string;
    overlapEnd: string;
}

export const getWorkerAllShifts = async (
    workerId: string,
    filters: WorkerAllShiftsFilters
) => {
    const now = new Date();
    const { status = 'upcoming', orgId, limit = 50, offset = 0 } = filters;

    // 1. Get all org memberships for this worker
    const memberships = await db.select({
        orgId: member.organizationId,
        role: member.role,
    })
        .from(member)
        .where(and(
            eq(member.userId, workerId),
            eq(member.status, 'active')
        ));

    if (memberships.length === 0) {
        return { shifts: [], conflicts: [], organizations: [] };
    }

    // If orgId filter provided, validate membership and filter
    let orgIds = memberships.map(m => m.orgId);
    if (orgId && orgId.length > 0) {
        if (!orgIds.includes(orgId)) {
            return { shifts: [], conflicts: [], organizations: [] };
        }
        orgIds = [orgId];
    }

    // 2. Build query conditions
    const conditions: any[] = [
        eq(shiftAssignment.workerId, workerId),
        ne(shiftAssignment.status, 'removed'),
        inArray(shift.organizationId, orgIds),
    ];

    if (status === 'in-progress') {
        // Clocked in but not clocked out, shift hasn't ended + 2hr buffer
        conditions.push(sql`${shiftAssignment.actualClockIn} IS NOT NULL`);
        conditions.push(sql`${shiftAssignment.actualClockOut} IS NULL`);
    } else if (status === 'upcoming') {
        conditions.push(inArray(shift.status, ['published', 'assigned', 'in-progress']));
        const bufferTime = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        conditions.push(gte(shift.endTime, bufferTime));
    } else if (status === 'history') {
        conditions.push(inArray(shift.status, ['completed', 'approved', 'cancelled']));
    }

    // 3. Query across all orgs
    const rows = await db
        .select({
            assignment: shiftAssignment,
            shift: shift,
            location: {
                id: location.id,
                name: location.name,
                address: location.address,
                geofenceRadius: location.geofenceRadius,
                latitude: sql<number>`ST_Y(${location.position}::geometry)`.mapWith(Number),
                longitude: sql<number>`ST_X(${location.position}::geometry)`.mapWith(Number),
            },
            organization: {
                id: organization.id,
                name: organization.name,
            },
        })
        .from(shiftAssignment)
        .innerJoin(shift, eq(shiftAssignment.shiftId, shift.id))
        .leftJoin(location, eq(shift.locationId, location.id))
        .innerJoin(organization, eq(shift.organizationId, organization.id))
        .where(and(...conditions))
        .orderBy(status === 'history' ? desc(shift.startTime) : asc(shift.startTime))
        .limit(limit)
        .offset(offset);

    // 4. Map to DTOs
    const shifts = rows.map(row => mapWorkerShiftDto(row));

    // 5. Detect cross-org conflicts (only for upcoming/in-progress)
    const conflicts: ConflictInfo[] = [];
    if (status !== 'history') {
        // Sort shifts by start time to detect overlaps in O(n log n) instead of O(n^2)
        const sortedShifts = [...shifts].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

        for (let i = 0; i < sortedShifts.length - 1; i++) {
            const current = sortedShifts[i];
            const next = sortedShifts[i + 1];

            if (!current || !next) continue;

            const currentStart = new Date(current.startTime);
            const currentEnd = new Date(current.endTime);
            const nextStart = new Date(next.startTime);
            const nextEnd = new Date(next.endTime);

            // Check time overlap
            if (currentStart < nextEnd && nextStart < currentEnd) {
                // If they belong to different orgs, it's a cross-org conflict
                if (current.organization.id !== next.organization.id) {
                    const overlapStart = (currentStart > nextStart ? currentStart : nextStart).toISOString();
                    const overlapEnd = (currentEnd < nextEnd ? currentEnd : nextEnd).toISOString();

                    conflicts.push({
                        shiftId: current.id,
                        overlapsWithShiftId: next.id,
                        overlapsWithTitle: next.title,
                        overlapsWithOrg: next.organization.name,
                        overlapStart: overlapStart,
                        overlapEnd: overlapEnd,
                    });
                    conflicts.push({
                        shiftId: next.id,
                        overlapsWithShiftId: current.id,
                        overlapsWithTitle: current.title,
                        overlapsWithOrg: current.organization.name,
                        overlapStart: overlapStart,
                        overlapEnd: overlapEnd,
                    });
                }
            }
        }
    }

    // 6. Org list for filter UI
    const organizations = memberships.map(m => ({
        id: m.orgId,
        role: m.role,
    }));

    // Enrich org names from the query results
    const orgNameMap = new Map<string, string>();
    rows.forEach(r => orgNameMap.set(r.organization.id, r.organization.name));

    // For orgs with no shifts in current view, fetch names separately
    const missingOrgIds = orgIds.filter(id => !orgNameMap.has(id));
    if (missingOrgIds.length > 0) {
        const missingOrgs = await db.select({ id: organization.id, name: organization.name })
            .from(organization)
            .where(inArray(organization.id, missingOrgIds));
        missingOrgs.forEach(o => orgNameMap.set(o.id, o.name));
    }

    return {
        shifts,
        conflicts,
        organizations: organizations.map(o => ({
            ...o,
            name: orgNameMap.get(o.id) || 'Unknown',
        })),
    };
};

// DTO Mapper — same shape as worker-shifts but with hours calculated
const mapWorkerShiftDto = (row: any) => {
    const s = row.shift;
    const a = row.assignment;
    const shiftEnded = new Date(s.endTime) < new Date();

    // Calculate total hours worked
    const clockIn = a.effectiveClockIn || a.actualClockIn;
    const clockOut = a.effectiveClockOut || a.actualClockOut;
    let totalHours: number | null = null;

    if (clockIn && clockOut) {
        const durationMs = new Date(clockOut).getTime() - new Date(clockIn).getTime();
        const breakMs = (a.breakMinutes || 0) * 60 * 1000;
        totalHours = Math.round(((durationMs - breakMs) / (1000 * 60 * 60)) * 100) / 100;
    } else if (a.totalDurationMinutes) {
        totalHours = Math.round((a.totalDurationMinutes / 60) * 100) / 100;
    }

    // Scheduled duration
    const scheduledMs = new Date(s.endTime).getTime() - new Date(s.startTime).getTime();
    const scheduledBreakMs = (a.breakMinutes || 0) * 60 * 1000;
    const scheduledHours = Math.round(((scheduledMs - scheduledBreakMs) / (1000 * 60 * 60)) * 100) / 100;

    return {
        id: s.id,
        assignmentId: a.id,
        title: s.title,
        description: s.description || undefined,
        startTime: s.startTime.toISOString(),
        endTime: s.endTime.toISOString(),
        status: s.status,
        assignmentStatus: a.status,
        organization: {
            id: row.organization.id,
            name: row.organization.name,
        },
        location: {
            id: row.location?.id || 'unknown',
            name: row.location?.name || 'Unknown Location',
            address: row.location?.address,
            latitude: row.location?.latitude ? Number(row.location.latitude) : undefined,
            longitude: row.location?.longitude ? Number(row.location.longitude) : undefined,
            geofenceRadius: row.location?.geofenceRadius || 150,
        },
        hours: {
            scheduled: scheduledHours,
            worked: totalHours,
            breakMinutes: a.breakMinutes || 0,
        },
        timesheet: {
            clockIn: a.actualClockIn?.toISOString() ?? undefined,
            clockOut: a.actualClockOut?.toISOString() ?? undefined,
            effectiveClockIn: a.effectiveClockIn?.toISOString() ?? undefined,
            effectiveClockOut: a.effectiveClockOut?.toISOString() ?? undefined,
            breakMinutes: a.breakMinutes || 0,
            totalDurationMinutes: a.totalDurationMinutes ?? undefined,
        },
        timesheetFlags: {
            missingClockIn: !a.actualClockIn && shiftEnded,
            missingClockOut: !!a.actualClockIn && !a.actualClockOut && shiftEnded,
            needsReview: a.needsReview || false,
            reviewReason: a.reviewReason ?? undefined,
        },
    };
};
