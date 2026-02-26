import { db } from "@repo/database";
import { shift, shiftAssignment, location, organization } from "@repo/database/schema";
import { eq, and, inArray, gte, lte, asc, desc, sql } from "drizzle-orm";

interface WorkerShiftFilters {
    status: 'upcoming' | 'history' | 'all';
    limit?: number;
    offset?: number;
}

export const getWorkerShifts = async (
    workerId: string,
    orgId: string,
    filters: WorkerShiftFilters
) => {
    const now = new Date();
    // Default status 'upcoming', limit 20
    const { status = 'upcoming', limit = 20, offset = 0 } = filters;

    // WH-105 Fix: Use db.select() with innerJoin to ensure filtering happens BEFORE pagination
    // This prevents "gaps" where mixed statuses in the DB cause pages to appear empty or incomplete.

    const conditions = [
        eq(shiftAssignment.workerId, workerId),
        eq(shift.organizationId, orgId)
    ];

    if (status === 'upcoming') {
        conditions.push(inArray(shift.status, ['published', 'assigned', 'in-progress']));
        // Include if shift hasn't ended yet (with 2hr buffer for late clock-outs)
        const bufferTime = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        conditions.push(gte(shift.endTime, bufferTime));
    } else if (status === 'history') {
        conditions.push(inArray(shift.status, ['completed', 'approved', 'cancelled']));
    }

    const query = db
        .select({
            assignment: shiftAssignment,
            shift: shift,
            location: {
                ...location,
                latitude: sql<number>`ST_Y(${location.position}::geometry)`.mapWith(Number),
                longitude: sql<number>`ST_X(${location.position}::geometry)`.mapWith(Number)
            },
            organization: organization
        })
        .from(shiftAssignment)
        .innerJoin(shift, eq(shiftAssignment.shiftId, shift.id))
        .leftJoin(location, eq(shift.locationId, location.id))
        .innerJoin(organization, eq(shift.organizationId, organization.id))
        .where(and(...conditions));

    // Sort order
    const orderedQuery = status === 'upcoming'
        ? query.orderBy(asc(shift.startTime))
        : query.orderBy(desc(shift.startTime));

    // Apply pagination at DB level
    const rows = await orderedQuery.limit(limit).offset(offset);

    // Transform results
    const results = rows.map(row => {
        // Reconstruct the nested object structure expected by the mapper
        const composite = {
            ...row.assignment,
            shift: {
                ...row.shift,
                location: row.location,
                organization: row.organization
            }
        };
        return mapWorkerShiftDto(composite);
    });

    return {
        shifts: results,
        pagination: {
            limit,
            offset,
            hasMore: results.length === limit // Simple heuristic
        }
    };
};

// DTO Mapper
interface WorkerShiftDto {
    id: string;
    assignmentId: string;
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    status: string;
    assignmentStatus: string;
    location: {
        id: string;
        name: string;
        address?: string;
        latitude?: number;
        longitude?: number;
        geofenceRadius?: number;
    };
    organization: {
        id: string;
        name: string;
    };
    timesheet: {
        clockIn?: string;
        clockOut?: string;
        effectiveClockIn?: string;
        effectiveClockOut?: string;
        breakMinutes: number;
        totalDurationMinutes?: number;
    };
    timesheetFlags: {
        missingClockIn: boolean;
        missingClockOut: boolean;
        needsReview: boolean;
        reviewReason?: string;
    };
}

const mapWorkerShiftDto = (assignment: any): WorkerShiftDto => {
    const s = assignment.shift;
    const shiftEnded = new Date(s.endTime) < new Date();

    return {
        id: s.id,
        assignmentId: assignment.id,
        title: s.title,
        description: s.description || undefined,
        startTime: s.startTime.toISOString(),
        endTime: s.endTime.toISOString(),
        status: s.status,
        assignmentStatus: assignment.status,
        location: {
            id: s.location?.id || 'unknown',
            name: s.location?.name || 'Unknown Location',
            address: s.location?.address,
            latitude: s.location?.latitude ? Number(s.location.latitude) : undefined,
            longitude: s.location?.longitude ? Number(s.location.longitude) : undefined,
            geofenceRadius: s.location?.geofenceRadius || 150
        },
        organization: {
            id: s.organization?.id || 'unknown',
            name: s.organization?.name || 'Unknown'
        },
        timesheet: {
            clockIn: assignment.actualClockIn?.toISOString() ?? undefined,
            clockOut: assignment.actualClockOut?.toISOString() ?? undefined,
            effectiveClockIn: assignment.effectiveClockIn?.toISOString() ?? undefined,
            effectiveClockOut: assignment.effectiveClockOut?.toISOString() ?? undefined,
            breakMinutes: assignment.breakMinutes || 0,
            totalDurationMinutes: assignment.totalDurationMinutes ?? undefined,
        },
        // Flags for UI: show ⚠️ warning icons next to missing times
        timesheetFlags: {
            missingClockIn: !assignment.actualClockIn && shiftEnded,
            missingClockOut: !!assignment.actualClockIn && !assignment.actualClockOut && shiftEnded,
            needsReview: assignment.needsReview || false,
            reviewReason: assignment.reviewReason ?? undefined,
        },
    };
};

/* // REMOVED per WOR-26
const calculateEstimatedPay = (start: Date, end: Date, rate: number): number => {
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return Math.round(hours * rate);
};
*/
