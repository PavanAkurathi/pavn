
import { db } from "@repo/database";
import { shift, shiftAssignment, user } from "@repo/database/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { differenceInMinutes } from "date-fns";
import { AppError } from "@repo/observability";

export async function exportTimesheetsController(
    orgId: string,
    startDate: string,
    endDate: string
): Promise<Response> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Include full end day

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new AppError("Invalid date format. Use YYYY-MM-DD", "INVALID_DATE", 400);
    }


    // Use db.select() with joins for better type safety and filtering on related tables
    const results = await db
        .select({
            workerName: user.name,
            workerEmail: user.email,
            shiftStart: shift.startTime,
            shiftTitle: shift.title,
            clockIn: shiftAssignment.clockIn,
            clockOut: shiftAssignment.clockOut,
            breakMinutes: shiftAssignment.breakMinutes,
            grossPayCents: shiftAssignment.grossPayCents,
        })
        .from(shiftAssignment)
        .innerJoin(shift, eq(shiftAssignment.shiftId, shift.id))
        .innerJoin(user, eq(shiftAssignment.workerId, user.id))
        .where(
            and(
                eq(shiftAssignment.status, 'completed'),
                eq(shift.organizationId, orgId),
                eq(shift.status, 'approved'),
                gte(shift.startTime, start),
                lte(shift.startTime, end)
            )
        );

    // CSV Header
    const headers = [
        'Worker Name', 'Worker Email', 'Shift Date', 'Shift Title',
        'Clock In', 'Clock Out', 'Break (min)', 'Total Hours', 'Gross Pay'
    ];

    const rows = results.map(row => {
        const totalMinutes = row.clockIn && row.clockOut
            ? differenceInMinutes(row.clockOut, row.clockIn) - (row.breakMinutes || 0)
            : 0;
        const totalHours = (totalMinutes / 60).toFixed(2);
        const grossPay = row.grossPayCents ? (row.grossPayCents / 100).toFixed(2) : '0.00';

        const sanitizeInfo = (val: unknown): string => {
            const s = String(val || '');
            // WH-106: Prevent CSV Injection
            if (/^[=+\-@\t\r]/.test(s)) {
                return "'" + s;
            }
            return s;
        };

        return [
            sanitizeInfo(row.workerName || 'Unknown'),
            sanitizeInfo(row.workerEmail || ''),
            sanitizeInfo(row.shiftStart.toISOString().split('T')[0]),
            sanitizeInfo(row.shiftTitle || ''),
            sanitizeInfo(row.clockIn?.toISOString() || ''),
            sanitizeInfo(row.clockOut?.toISOString() || ''),
            String(row.breakMinutes || 0), // Numbers usually safe, but String() ensures
            totalHours,
            grossPay
        ];
    });

    // Build CSV
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return new Response(csvContent, {
        status: 200,
        headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="timesheets-${startDate}-to-${endDate}.csv"`
        }
    });

}
