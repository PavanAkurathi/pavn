import { db } from "@repo/database";
import { shift, shiftAssignment, user, location } from "@repo/database/schema";
import { eq, and, gte, lte, like, inArray, ilike } from "drizzle-orm";
import { differenceInMinutes, format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { AppError } from "@repo/observability";
import { z } from "zod";

// Query parameter schema
const ExportQuerySchema = z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    locationId: z.string().optional(),
    position: z.string().optional(),
    workerId: z.string().optional(),
    search: z.string().optional(),
    format: z.enum(['csv', 'excel']).optional().default('csv'),
});

export async function exportTimesheetsController(
    orgId: string,
    queryParams: Record<string, string>
): Promise<Response> {
    // Parse and validate query params
    const parsed = ExportQuerySchema.safeParse(queryParams);
    if (!parsed.success) {
        throw new AppError("Invalid query parameters", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const { start: startDate, end: endDate, locationId, position, workerId, search, format: exportFormat } = parsed.data;

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new AppError("Invalid date format. Use YYYY-MM-DD", "INVALID_DATE", 400);
    }

    // Build WHERE conditions dynamically
    const conditions = [
        eq(shift.organizationId, orgId),
        eq(shift.status, 'approved'),
        gte(shift.startTime, start),
        lte(shift.startTime, end),
        // Only include completed/approved assignments (not no-shows by default)
        inArray(shiftAssignment.status, ['completed', 'approved', 'active']),
    ];

    if (locationId) {
        conditions.push(eq(shift.locationId, locationId));
    }

    if (position) {
        // Case-insensitive position filter via ILIKE workaround
        conditions.push(eq(shift.title, position));
    }

    if (workerId) {
        conditions.push(eq(shiftAssignment.workerId, workerId));
    }

    if (search) {
        conditions.push(ilike(user.name, `%${search}%`));
    }

    // Enhanced SELECT with location join
    const results = await db
        .select({
            // Worker info
            workerName: user.name,
            workerEmail: user.email,
            workerPhone: user.phoneNumber,
            // Position/Role
            position: shift.title,
            // Location
            locationName: location.name,
            locationAddress: location.address,
            // Scheduled times
            scheduledStart: shift.startTime,
            scheduledEnd: shift.endTime,
            shiftPrice: shift.price,
            // Actuals
            clockIn: shiftAssignment.clockIn,
            clockOut: shiftAssignment.clockOut,
            breakMinutes: shiftAssignment.breakMinutes,
            grossPayCents: shiftAssignment.grossPayCents,
            assignmentStatus: shiftAssignment.status,
        })
        .from(shiftAssignment)
        .innerJoin(shift, eq(shiftAssignment.shiftId, shift.id))
        .innerJoin(user, eq(shiftAssignment.workerId, user.id))
        .leftJoin(location, eq(shift.locationId, location.id))
        .where(and(...conditions))
        .limit(10001); // SQL limit for safety

    // Check row limit
    if (results.length > 10000) {
        throw new AppError(
            "Export too large. Please narrow your date range or add filters.",
            "EXPORT_TOO_LARGE",
            400,
            { rowCount: results.length, maxAllowed: 10000 }
        );
    }

    // Direct usage of results (no in-memory filtering needed)
    const filteredResults = results;

    // CSV Headers (16 columns)
    const headers = [
        'Worker Name', 'Worker Email', 'Worker Phone', 'Position',
        'Location', 'Location Address', 'Date',
        'Scheduled Start', 'Scheduled End', 'Actual Start', 'Actual End',
        'Break (min)', 'Total Hours', 'Hourly Rate', 'Total Pay', 'Status'
    ];

    const rows = filteredResults.map(row => {
        // Calculate hours
        const totalMinutes = row.clockIn && row.clockOut
            ? differenceInMinutes(row.clockOut, row.clockIn) - (row.breakMinutes || 0)
            : 0;
        const totalHours = (totalMinutes / 60).toFixed(2);
        const grossPay = row.grossPayCents ? (row.grossPayCents / 100).toFixed(2) : '0.00';
        const hourlyRate = row.shiftPrice ? (row.shiftPrice / 100).toFixed(2) : '0.00';

        // CSV Injection Prevention
        const sanitize = (val: unknown): string => {
            const s = String(val ?? '');
            if (/^[=+\-@\t\r]/.test(s)) {
                return "'" + s;
            }
            return s;
        };

        // Format times as HH:MM
        const formatTime = (date: Date | null): string => {
            if (!date) return '';
            return format(date, 'HH:mm');
        };

        // Format date as YYYY-MM-DD
        const formatDate = (date: Date): string => {
            return format(date, 'yyyy-MM-dd');
        };

        return [
            sanitize(row.workerName || 'Unknown'),
            sanitize(row.workerEmail || ''),
            sanitize(row.workerPhone || ''),
            sanitize(row.position || ''),
            sanitize(row.locationName || ''),
            sanitize(row.locationAddress || ''),
            formatDate(row.scheduledStart),
            formatTime(row.scheduledStart),
            formatTime(row.scheduledEnd),
            formatTime(row.clockIn),
            formatTime(row.clockOut),
            String(row.breakMinutes || 0),
            totalHours,
            hourlyRate,
            grossPay,
            sanitize(row.assignmentStatus || 'completed'),
        ];
    });

    // Build CSV
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Return empty file with headers if no data
    const filename = `timesheets-${startDate}-to-${endDate}`;

    if (exportFormat === 'csv') {
        return new Response(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}.csv"`
            }
        });
    }

    // Excel format - for now return CSV with xlsx extension (placeholder)
    // TODO: Add exceljs for proper Excel generation
    return new Response(csvContent, {
        status: 200,
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}.csv"`
        }
    });
}
