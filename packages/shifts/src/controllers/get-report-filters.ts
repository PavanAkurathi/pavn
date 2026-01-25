import { db } from "@repo/database";
import { shift, location } from "@repo/database/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";

const FilterQuerySchema = z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function getReportFiltersController(
    orgId: string,
    queryParams: Record<string, string>
): Promise<Response> {
    const parsed = FilterQuerySchema.safeParse(queryParams);
    const { start: startDate, end: endDate } = parsed.success ? parsed.data : { start: undefined, end: undefined };

    // Build date conditions if provided
    const dateConditions = [];
    if (startDate) {
        dateConditions.push(gte(shift.startTime, new Date(startDate)));
    }
    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateConditions.push(lte(shift.startTime, end));
    }

    // Query distinct locations
    const locationsResult = await db
        .selectDistinct({
            id: location.id,
            name: location.name,
        })
        .from(shift)
        .innerJoin(location, eq(shift.locationId, location.id))
        .where(and(
            eq(shift.organizationId, orgId),
            eq(shift.status, 'approved'),
            ...dateConditions
        ))
        .orderBy(location.name);

    // Query distinct positions
    const positionsResult = await db
        .selectDistinct({
            title: shift.title,
        })
        .from(shift)
        .where(and(
            eq(shift.organizationId, orgId),
            eq(shift.status, 'approved'),
            ...dateConditions
        ))
        .orderBy(shift.title);

    return Response.json({
        locations: locationsResult.map(l => ({ id: l.id, name: l.name || '' })),
        positions: positionsResult.map(p => p.title).filter(Boolean),
    });
}
