import { db } from "@repo/database";
import { shift, shiftTemplate, location } from "@repo/database/schema";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@repo/observability";
import { newId } from "../../utils/ids";
import { combineDateTimeTz, addDaysToLocalDate, localDateInZone } from "../../utils/zoned-time";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_POSITIONS = 20;
const MAX_DATES_PER_APPLY = 31;

const PositionSchema = z.object({
    roleName: z.string().min(1, "Every position needs a role"),
    headcount: z.number().int().min(1).max(50),
});

const CreateTemplateSchema = z.object({
    name: z.string().min(1, "Give the template a name").max(80),
    locationId: z.string(),
    startTime: z.string().regex(HHMM, "Expected HH:MM"),
    endTime: z.string().regex(HHMM, "Expected HH:MM"),
    positions: z.array(PositionSchema).min(1, "A template needs at least one position").max(MAX_POSITIONS),
});

const ApplyTemplateSchema = z.object({
    dates: z
        .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"))
        .min(1, "Pick at least one day")
        .max(MAX_DATES_PER_APPLY, `Cannot apply to more than ${MAX_DATES_PER_APPLY} days at once`),
});

/**
 * Save a shift shape for reuse: roles, headcount, hours, place. No dates, no
 * people — see the note on the table.
 */
export const createShiftTemplate = async (body: unknown, orgId: string) => {
    const parsed = CreateTemplateSchema.safeParse(body);
    if (!parsed.success) {
        throw new AppError("Validation failed", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const { name, locationId, startTime, endTime, positions } = parsed.data;

    const locationRecord = await db.query.location.findFirst({
        where: and(eq(location.id, locationId), eq(location.organizationId, orgId)),
        columns: { id: true },
    });

    if (!locationRecord) {
        throw new AppError("Location not found", "NOT_FOUND", 404);
    }

    const id = newId("tpl");
    await db.insert(shiftTemplate).values({
        id,
        organizationId: orgId,
        locationId,
        name,
        startTime,
        endTime,
        positions,
    });

    return { success: true, id, name };
};

export const listShiftTemplates = async (orgId: string) => {
    const rows = await db.query.shiftTemplate.findMany({
        where: eq(shiftTemplate.organizationId, orgId),
        orderBy: [asc(shiftTemplate.name)],
        with: { location: { columns: { id: true, name: true, timezone: true } } },
    });

    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        locationId: row.locationId,
        locationName: row.location?.name ?? "",
        timezone: row.location?.timezone ?? undefined,
        startTime: row.startTime,
        endTime: row.endTime,
        positions: row.positions,
        // What one day of this template costs in bodies — the number a manager
        // is actually deciding on.
        headcount: row.positions.reduce((sum, position) => sum + position.headcount, 0),
    }));
};

export const deleteShiftTemplate = async (templateId: string, orgId: string) => {
    const existing = await db.query.shiftTemplate.findFirst({
        where: and(eq(shiftTemplate.id, templateId), eq(shiftTemplate.organizationId, orgId)),
        columns: { id: true },
    });

    if (!existing) {
        throw new AppError("Template not found", "NOT_FOUND", 404);
    }

    await db.delete(shiftTemplate).where(eq(shiftTemplate.id, templateId));
    return { success: true };
};

/**
 * Lay a template onto real days.
 *
 * Produces drafts, never published shifts — the same rule Copy last week
 * follows, so nothing reaches a worker until a manager says so. Days that
 * already have shifts at this location are left alone, so applying twice does
 * not double the day.
 */
export const applyShiftTemplate = async (templateId: string, body: unknown, orgId: string) => {
    const parsed = ApplyTemplateSchema.safeParse(body);
    if (!parsed.success) {
        throw new AppError("Validation failed", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const template = await db.query.shiftTemplate.findFirst({
        where: and(eq(shiftTemplate.id, templateId), eq(shiftTemplate.organizationId, orgId)),
        with: { location: { columns: { id: true, timezone: true } } },
    });

    if (!template) {
        throw new AppError("Template not found", "NOT_FOUND", 404);
    }

    const timezone = template.location?.timezone;
    if (!timezone) {
        throw new AppError(
            "This template's location has no timezone set, so its hours cannot be placed on a date.",
            "VALIDATION_ERROR",
            400,
        );
    }

    const dates = Array.from(new Set(parsed.data.dates)).sort();

    // One probe across the whole span rather than a query per day.
    const spanStart = combineDateTimeTz(dates[0]!, "00:00", timezone);
    const spanEnd = combineDateTimeTz(addDaysToLocalDate(dates[dates.length - 1]!, 1), "00:00", timezone);

    const existing = await db.query.shift.findMany({
        where: and(
            eq(shift.organizationId, orgId),
            eq(shift.locationId, template.locationId),
            gte(shift.startTime, spanStart),
            lt(shift.startTime, spanEnd),
        ),
        columns: { id: true, startTime: true },
    });

    const occupiedDays = new Set(existing.map((row) => localDateInZone(row.startTime, timezone)));

    const scheduleGroupId = newId("int");
    const rows: (typeof shift.$inferInsert)[] = [];
    const skippedDays: string[] = [];

    for (const date of dates) {
        if (occupiedDays.has(date)) {
            skippedDays.push(date);
            continue;
        }

        const startTime = combineDateTimeTz(date, template.startTime, timezone);
        // An end time earlier than the start means the shift runs past midnight.
        const overnight = template.endTime <= template.startTime;
        const endTime = combineDateTimeTz(
            overnight ? addDaysToLocalDate(date, 1) : date,
            template.endTime,
            timezone,
        );

        for (const position of template.positions) {
            rows.push({
                id: newId("shf"),
                organizationId: orgId,
                locationId: template.locationId,
                title: position.roleName,
                description: template.name,
                startTime,
                endTime,
                timezone,
                capacityTotal: position.headcount,
                status: "draft",
                scheduleGroupId,
            });
        }
    }

    if (rows.length === 0) {
        return {
            created: 0,
            skippedDays,
            message: "Every day you picked already has shifts at this location.",
        };
    }

    await db.insert(shift).values(rows);

    return {
        created: rows.length,
        days: dates.length - skippedDays.length,
        skippedDays,
        scheduleGroupId,
    };
};

/**
 * Turn a shift that already exists into a template.
 *
 * Takes every position in the block — the concurrent shifts sharing its start,
 * end and location — so saving "the Saturday night crew" keeps the whole crew,
 * not just the row that was clicked.
 */
export const createTemplateFromShift = async (shiftId: string, name: string, orgId: string) => {
    const source = await db.query.shift.findFirst({
        where: and(eq(shift.id, shiftId), eq(shift.organizationId, orgId)),
        with: { location: { columns: { id: true, timezone: true } } },
    });

    if (!source) {
        throw new AppError("Shift not found", "NOT_FOUND", 404);
    }

    if (!source.locationId) {
        throw new AppError("This shift has no location, so it cannot become a template.", "VALIDATION_ERROR", 400);
    }

    const timezone = source.timezone || source.location?.timezone;
    if (!timezone) {
        throw new AppError("This shift has no timezone, so its hours cannot be saved.", "VALIDATION_ERROR", 400);
    }

    const siblings = await db.query.shift.findMany({
        where: and(
            eq(shift.organizationId, orgId),
            eq(shift.locationId, source.locationId),
            eq(shift.startTime, source.startTime),
            eq(shift.endTime, source.endTime),
        ),
        columns: { id: true, title: true, capacityTotal: true, status: true },
    });

    // Roles the manager already called off are not part of the shape.
    const positions = siblings
        .filter((sibling) => sibling.status !== "cancelled")
        .map((sibling) => ({ roleName: sibling.title, headcount: sibling.capacityTotal ?? 1 }));

    if (positions.length === 0) {
        throw new AppError("Nothing left on this shift to save.", "VALIDATION_ERROR", 400);
    }

    return createShiftTemplate(
        {
            name,
            locationId: source.locationId,
            startTime: localTimeOf(source.startTime, timezone),
            endTime: localTimeOf(source.endTime, timezone),
            positions: positions.slice(0, MAX_POSITIONS),
        },
        orgId,
    );
};

function localTimeOf(instant: Date, timezone: string) {
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(instant);
}
