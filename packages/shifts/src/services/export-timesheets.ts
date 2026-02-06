// [PAY-001] Professional Excel Export (SpreadsheetML XML)
// Does not require 'exceljs' dependency but opens natively in Excel.

import { db } from "@repo/database";
import { shift, shiftAssignment, user, location, organization } from "@repo/database/schema";
import { eq, and, gte, lte, like, inArray, ilike, desc, asc } from "drizzle-orm";
import { differenceInMinutes, format, startOfWeek, endOfWeek, isSameWeek } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { AppError } from "@repo/observability";
import { calculateDailyOvertimeMinutes } from "@repo/config";
import { z } from "zod";

// Query parameter schema
const ExportQuerySchema = z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    locationId: z.string().optional(),
    position: z.string().optional(),
    workerId: z.string().optional(),
    search: z.string().optional(),
    format: z.enum(['csv', 'excel']).optional().default('excel'),
});

export async function exportTimesheets(
    orgId: string,
    queryParams: Record<string, string>
) {
    // Parse and validate query params
    const parsed = ExportQuerySchema.safeParse(queryParams);
    if (!parsed.success) {
        throw new AppError("Invalid query parameters", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const { start: startDate, end: endDate, locationId, position, workerId, search } = parsed.data;

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // 1. Fetch Organization Policy
    const orgRecord = await db.query.organization.findFirst({
        where: eq(organization.id, orgId),
        columns: { regionalOvertimePolicy: true }
    });
    const overtimePolicy = orgRecord?.regionalOvertimePolicy || 'weekly_40'; // 'daily_8' or 'weekly_40'

    // Build WHERE conditions
    const conditions = [
        eq(shift.organizationId, orgId),
        eq(shift.status, 'approved'),
        gte(shift.startTime, start),
        lte(shift.startTime, end),
        inArray(shiftAssignment.status, ['completed', 'approved', 'active']),
    ];

    if (locationId) conditions.push(eq(shift.locationId, locationId));
    if (position) conditions.push(eq(shift.title, position));
    if (workerId) conditions.push(eq(shiftAssignment.workerId, workerId));
    if (search) conditions.push(ilike(user.name, `%${search}%`));

    // Fetch Data
    const results = await db
        .select({
            workerId: user.id,
            workerName: user.name,
            workerEmail: user.email,
            position: shift.title,
            locationName: location.name,
            scheduledStart: shift.startTime,
            scheduledEnd: shift.endTime,
            shiftPrice: shift.price,
            clockIn: shiftAssignment.effectiveClockIn,
            clockOut: shiftAssignment.effectiveClockOut,
            breakMinutes: shiftAssignment.breakMinutes,
            grossPayCents: shiftAssignment.estimatedCostCents,
            hourlyRateSnapshot: shiftAssignment.budgetRateSnapshot,
            assignmentStatus: shiftAssignment.status,
        })
        .from(shiftAssignment)
        .innerJoin(shift, eq(shiftAssignment.shiftId, shift.id))
        .innerJoin(user, eq(shiftAssignment.workerId, user.id))
        .leftJoin(location, eq(shift.locationId, location.id))
        .where(and(...conditions))
        .orderBy(asc(user.name), asc(shift.startTime)); // Sort by Worker, then Date for calc

    // 2. Process Data (Calculate Overtime)
    // We need to track weekly totals if policy is 'weekly_40'
    const processedRows = [];
    const workerWeeklyHours: Record<string, Record<string, number>> = {}; // workerId -> weekKey -> minutes

    for (const row of results) {
        if (!row.clockIn || !row.clockOut) continue;

        const totalMinutes = Math.max(0, differenceInMinutes(row.clockOut, row.clockIn) - (row.breakMinutes || 0));
        let regularMinutes = totalMinutes;
        let overtimeMinutes = 0;

        if (overtimePolicy === 'daily_8') {
            overtimeMinutes = calculateDailyOvertimeMinutes(totalMinutes, 'daily_8');
            regularMinutes = totalMinutes - overtimeMinutes;
        } else if (overtimePolicy === 'weekly_40') {
            const weekKey = format(startOfWeek(row.scheduledStart), 'yyyy-MM-dd');

            let workerRecord = workerWeeklyHours[row.workerId];
            if (!workerRecord) {
                workerRecord = {};
                workerWeeklyHours[row.workerId] = workerRecord;
            }

            const currentTotal = workerRecord[weekKey] || 0;

            // Re-calc logic:
            // This is a simplified sequential sweep. It assumes we processing in chronological order per worker.
            // If previous shifts already filled the bucket, this whole shift might be OT.

            const limit = 40 * 60; // 2400 mins

            if (currentTotal >= limit) {
                // Already over limit, all is overtime
                regularMinutes = 0;
                overtimeMinutes = totalMinutes;
            } else if (currentTotal + totalMinutes > limit) {
                // Split
                regularMinutes = limit - currentTotal;
                overtimeMinutes = totalMinutes - regularMinutes;
            }

            // Update bucket
            workerRecord[weekKey] = currentTotal + totalMinutes;
        }

        const hourlyRate = (row.hourlyRateSnapshot || row.shiftPrice || 0) / 100;
        const regularHours = regularMinutes / 60;
        const overtimeHours = overtimeMinutes / 60;

        // Calculate Pay
        const regularPay = regularHours * hourlyRate;
        const overtimePay = overtimeHours * hourlyRate * 1.5;
        const totalPay = regularPay + overtimePay;

        processedRows.push({
            ...row,
            totalMinutes,
            regularHours,
            overtimeHours,
            hourlyRate,
            totalPay
        });
    }

    // 3. Generate Output (XML Spreadsheet)
    const xmlBody = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="Timesheets">
  <Table>
   <Row>
    <Cell><Data ss:Type="String">Worker Name</Data></Cell>
    <Cell><Data ss:Type="String">Email</Data></Cell>
    <Cell><Data ss:Type="String">Date</Data></Cell>
    <Cell><Data ss:Type="String">Total Minutes</Data></Cell>
    <Cell><Data ss:Type="String">Break (min)</Data></Cell>
    <Cell><Data ss:Type="String">Regular Hours</Data></Cell>
    <Cell><Data ss:Type="String">Overtime Hours</Data></Cell>
    <Cell><Data ss:Type="String">Hourly Rate</Data></Cell>
    <Cell><Data ss:Type="String">Total Pay</Data></Cell>
   </Row>
   ${processedRows.map(row => `
   <Row>
    <Cell><Data ss:Type="String">${escapeXml(row.workerName)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(row.workerEmail)}</Data></Cell>
    <Cell><Data ss:Type="String">${format(row.scheduledStart, 'yyyy-MM-dd')}</Data></Cell>
    <Cell><Data ss:Type="Number">${row.totalMinutes}</Data></Cell>
    <Cell><Data ss:Type="Number">${row.breakMinutes || 0}</Data></Cell>
    <Cell><Data ss:Type="Number">${row.regularHours.toFixed(2)}</Data></Cell>
    <Cell><Data ss:Type="Number">${row.overtimeHours.toFixed(2)}</Data></Cell>
    <Cell><Data ss:Type="Number">${row.hourlyRate.toFixed(2)}</Data></Cell>
    <Cell><Data ss:Type="Number">${row.totalPay.toFixed(2)}</Data></Cell>
   </Row>`).join('')}
  </Table>
 </Worksheet>
</Workbook>`;

    const filename = `payroll_export_${startDate}_${endDate}.xls`;

    return {
        data: xmlBody,
        contentType: 'application/vnd.ms-excel',
        filename
    };
}

function escapeXml(unsafe: string | null): string {
    if (!unsafe) return '';
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
        return c;
    });
}
