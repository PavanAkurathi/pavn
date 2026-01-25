import { db } from "@repo/database";
import { shift, shiftAssignment, user, location } from "@repo/database/schema";
import { eq, and, gte, lte, inArray, sql, desc, asc, ilike } from "drizzle-orm";
import { differenceInMinutes, format } from "date-fns";
import { AppError } from "@repo/observability";
import { z } from "zod";

// Query parameter schema
const PreviewQuerySchema = z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    locationId: z.string().optional(),
    position: z.string().optional(),
    workerId: z.string().optional(),
    search: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).optional().default(50),
    offset: z.coerce.number().min(0).optional().default(0),
    sortBy: z.enum(['date', 'worker', 'position', 'location']).optional().default('date'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export async function getTimesheetsReportController(
    orgId: string,
    queryParams: Record<string, string>
): Promise<Response> {
    const parsed = PreviewQuerySchema.safeParse(queryParams);
    if (!parsed.success) {
        throw new AppError("Invalid query parameters", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const { start: startDate, end: endDate, locationId, position, workerId, search, limit, offset, sortBy, sortOrder } = parsed.data;

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Build WHERE conditions
    const conditions = [
        eq(shift.organizationId, orgId),
        eq(shift.status, 'approved'),
        gte(shift.startTime, start),
        lte(shift.startTime, end),
        inArray(shiftAssignment.status, ['completed', 'approved', 'active']),
    ];

    if (locationId) {
        conditions.push(eq(shift.locationId, locationId));
    }

    if (position) {
        conditions.push(eq(shift.title, position));
    }

    if (workerId) {
        conditions.push(eq(shiftAssignment.workerId, workerId));
    }

    if (search) {
        conditions.push(ilike(user.name, `%${search}%`));
    }

    // Query data
    const results = await db
        .select({
            assignmentId: shiftAssignment.id,
            workerId: user.id,
            workerName: user.name,
            workerEmail: user.email,
            workerImage: user.image,
            shiftId: shift.id,
            position: shift.title,
            shiftDate: shift.startTime,
            scheduledStart: shift.startTime,
            scheduledEnd: shift.endTime,
            locationId: location.id,
            locationName: location.name,
            clockIn: shiftAssignment.clockIn,
            clockOut: shiftAssignment.clockOut,
            breakMinutes: shiftAssignment.breakMinutes,
            grossPayCents: shiftAssignment.grossPayCents,
            shiftPrice: shift.price,
            assignmentStatus: shiftAssignment.status,
        })
        .from(shiftAssignment)
        .innerJoin(shift, eq(shiftAssignment.shiftId, shift.id))
        .innerJoin(user, eq(shiftAssignment.workerId, user.id))
        .leftJoin(location, eq(shift.locationId, location.id))
        .where(and(...conditions))
        .orderBy(sortOrder === 'desc' ? desc(shift.startTime) : asc(shift.startTime))
        .limit(limit + 1) // Fetch one extra to check hasMore
        .offset(offset);

    // Apply search filter (Moved to SQL)
    const filteredResults = results;

    // Check if there are more results
    const hasMore = filteredResults.length > limit;
    const pageResults = hasMore ? filteredResults.slice(0, limit) : filteredResults;

    // Calculate summary (would be better as aggregate query for large datasets)
    const uniqueWorkers = new Set(pageResults.map(r => r.workerId));
    let totalHours = 0;
    let totalPay = 0;

    // Transform to response format
    const data = pageResults.map(row => {
        const totalMinutes = row.clockIn && row.clockOut
            ? differenceInMinutes(row.clockOut, row.clockIn) - (row.breakMinutes || 0)
            : 0;
        const hours = totalMinutes / 60;
        const pay = row.grossPayCents ? row.grossPayCents / 100 : 0;

        totalHours += hours;
        totalPay += pay;

        // Generate initials
        const initials = row.workerName
            ?.split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2) || '??';

        return {
            id: row.assignmentId,
            worker: {
                id: row.workerId,
                name: row.workerName || 'Unknown',
                email: row.workerEmail || '',
                avatarUrl: row.workerImage || undefined,
                initials,
            },
            shift: {
                id: row.shiftId,
                title: row.position,
                date: format(row.shiftDate, 'yyyy-MM-dd'),
                scheduledStart: format(row.scheduledStart, 'HH:mm'),
                scheduledEnd: format(row.scheduledEnd, 'HH:mm'),
            },
            location: row.locationId ? {
                id: row.locationId,
                name: row.locationName || '',
            } : null,
            timesheet: {
                actualStart: row.clockIn ? format(row.clockIn, 'HH:mm') : null,
                actualEnd: row.clockOut ? format(row.clockOut, 'HH:mm') : null,
                breakMinutes: row.breakMinutes || 0,
                totalHours: Math.round(hours * 100) / 100,
                hourlyRate: row.shiftPrice ? row.shiftPrice / 100 : 0,
                totalPay: Math.round(pay * 100) / 100,
            },
            status: row.assignmentStatus,
        };
    });

    return Response.json({
        data,
        pagination: {
            total: data.length, // Note: For accurate count, need separate COUNT query
            limit,
            offset,
            hasMore,
        },
        summary: {
            totalWorkers: uniqueWorkers.size,
            totalHours: Math.round(totalHours * 100) / 100,
            totalPay: Math.round(totalPay * 100) / 100,
        },
    });
}
