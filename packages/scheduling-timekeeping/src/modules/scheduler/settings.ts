// packages/scheduling-timekeeping/src/modules/scheduler/settings.ts

/**
 * How an organization schedules: the three onboarding answers, the settings
 * they seed, and departments. Presets, not configuration: every answer only
 * picks a default that stays editable in Settings → Scheduling.
 */

import { db } from "@repo/database";
import { department, organization } from "@repo/database/schema";
import { AppError } from "@repo/observability";
import {
    BUSINESS_TYPE_PRESETS,
    DepartmentInputSchema,
    DepartmentUpdateSchema,
    SchedulingSetupInputSchema,
    UpdateSchedulingSettingsSchema,
    type SchedulingDepartment,
    type SchedulingSettings,
} from "@repo/contracts/scheduler";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import type { ZodType } from "zod";

import { canonicalizeCrewRole } from "../../utils/crew-roles";
import { newId } from "../../utils/ids";

function parse<T>(schema: ZodType<T>, input: unknown): T {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
        throw new AppError(
            parsed.error.issues[0]?.message ?? "Validation failed",
            "VALIDATION_ERROR",
            400,
            parsed.error.flatten(),
        );
    }
    return parsed.data;
}

/** Canonical spelling, first occurrence wins, blanks dropped. */
export function canonicalDepartmentRoles(roles: readonly string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of roles) {
        const role = canonicalizeCrewRole(raw);
        if (role && !seen.has(role.toLowerCase())) {
            seen.add(role.toLowerCase());
            out.push(role);
        }
    }
    return out;
}

const toDepartment = (row: { id: string; name: string; roles: string[]; sortOrder: number }): SchedulingDepartment => ({
    id: row.id,
    name: row.name,
    roles: row.roles,
    sortOrder: row.sortOrder,
});

async function loadDepartments(orgId: string): Promise<SchedulingDepartment[]> {
    const rows = await db.query.department.findMany({
        where: eq(department.organizationId, orgId),
        orderBy: [asc(department.sortOrder), asc(department.name)],
    });
    return rows.map(toDepartment);
}

export async function getSchedulingSettings(orgId: string): Promise<SchedulingSettings> {
    const org = await db.query.organization.findFirst({
        where: eq(organization.id, orgId),
        columns: {
            businessType: true,
            scheduleStyle: true,
            openShiftClaimPolicy: true,
            swapApprovalRequired: true,
            weekStartsOn: true,
            regionalOvertimePolicy: true,
        },
    });
    if (!org) throw new AppError("Organization not found", "ORG_NOT_FOUND", 404);

    return {
        businessType: (org.businessType ?? null) as SchedulingSettings["businessType"],
        scheduleStyle: org.scheduleStyle as SchedulingSettings["scheduleStyle"],
        openShiftClaimPolicy: org.openShiftClaimPolicy as SchedulingSettings["openShiftClaimPolicy"],
        swapApprovalRequired: org.swapApprovalRequired,
        weekStartsOn: org.weekStartsOn,
        overtimePolicy: org.regionalOvertimePolicy === "daily_8" ? "daily_8" : "weekly_40",
        departments: await loadDepartments(orgId),
    };
}

export async function updateSchedulingSettings(orgId: string, input: unknown): Promise<SchedulingSettings> {
    const data = parse(UpdateSchedulingSettingsSchema, input);
    const { overtimePolicy, ...rest } = data;

    await db
        .update(organization)
        .set({
            ...rest,
            ...(overtimePolicy ? { regionalOvertimePolicy: overtimePolicy } : {}),
        })
        .where(eq(organization.id, orgId));

    return getSchedulingSettings(orgId);
}

/**
 * Saves the onboarding answers. Departments are seeded from the business type
 * only while the organization has none, so answering again (or changing the
 * business type later) never overwrites departments someone has edited.
 */
export async function applySchedulingSetup(orgId: string, input: unknown): Promise<SchedulingSettings> {
    const answers = parse(SchedulingSetupInputSchema, input);

    await db.transaction(async (tx) => {
        await tx
            .update(organization)
            .set(answers)
            .where(eq(organization.id, orgId));

        const existing = await tx.query.department.findFirst({
            where: eq(department.organizationId, orgId),
            columns: { id: true },
        });
        if (existing) return;

        const preset = BUSINESS_TYPE_PRESETS[answers.businessType];
        await tx.insert(department).values(
            preset.departments.map((d, index) => ({
                id: newId("dep"),
                organizationId: orgId,
                name: d.name,
                roles: canonicalDepartmentRoles(d.roles),
                sortOrder: index,
            })),
        );
    });

    return getSchedulingSettings(orgId);
}

export async function listDepartments(orgId: string): Promise<SchedulingDepartment[]> {
    return loadDepartments(orgId);
}

async function assertNameFree(orgId: string, name: string, exceptId?: string) {
    const clash = await db.query.department.findFirst({
        where: and(
            eq(department.organizationId, orgId),
            sql`lower(${department.name}) = ${name.toLowerCase()}`,
            exceptId ? ne(department.id, exceptId) : undefined,
        ),
        columns: { id: true },
    });
    if (clash) {
        throw new AppError(`There is already a department called ${name}`, "DEPARTMENT_NAME_TAKEN", 409);
    }
}

export async function createDepartment(orgId: string, input: unknown): Promise<SchedulingDepartment> {
    const data = parse(DepartmentInputSchema, input);
    await assertNameFree(orgId, data.name);

    const [last] = await db.query.department.findMany({
        where: eq(department.organizationId, orgId),
        orderBy: (d, { desc }) => [desc(d.sortOrder)],
        limit: 1,
        columns: { sortOrder: true },
    });

    const [row] = await db
        .insert(department)
        .values({
            id: newId("dep"),
            organizationId: orgId,
            name: data.name,
            roles: canonicalDepartmentRoles(data.roles),
            sortOrder: last ? last.sortOrder + 1 : 0,
        })
        .returning();
    return toDepartment(row!);
}

export async function updateDepartment(orgId: string, departmentId: string, input: unknown): Promise<SchedulingDepartment> {
    const data = parse(DepartmentUpdateSchema, input);
    if (data.name !== undefined) await assertNameFree(orgId, data.name, departmentId);

    const [row] = await db
        .update(department)
        .set({
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.roles !== undefined ? { roles: canonicalDepartmentRoles(data.roles) } : {}),
            ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
            updatedAt: new Date(),
        })
        .where(and(eq(department.id, departmentId), eq(department.organizationId, orgId)))
        .returning();
    if (!row) throw new AppError("Department not found", "DEPARTMENT_NOT_FOUND", 404);
    return toDepartment(row);
}

export async function deleteDepartment(orgId: string, departmentId: string): Promise<{ id: string }> {
    const [row] = await db
        .delete(department)
        .where(and(eq(department.id, departmentId), eq(department.organizationId, orgId)))
        .returning({ id: department.id });
    if (!row) throw new AppError("Department not found", "DEPARTMENT_NOT_FOUND", 404);
    return row;
}
