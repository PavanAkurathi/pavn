import { db, resolveWorkerRoleSet } from "@repo/database";
import { worker } from "@repo/database/schema";
import { isValidPhoneNumber, normalizePhoneNumber } from "@repo/auth";
import { AppError } from "@repo/observability";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

export const WorkerFieldsSchema = z.object({
    name: z.string().trim().min(1, "Name is required"),
    phoneNumber: z.string().trim().optional().nullable(),
    email: z.string().trim().email().optional().nullable(),
    jobTitle: z.string().trim().optional().nullable(),
    roles: z.array(z.string().min(1)).optional(),
    hourlyRate: z.number().int().nonnegative().optional().nullable(),
    employmentType: z.enum(["staff", "agency"]).optional(),
    agency: z.string().trim().optional().nullable(),
    notes: z.string().trim().optional().nullable(),
});

export type WorkerFields = z.infer<typeof WorkerFieldsSchema>;

/** Turns what a manager typed into an E.164 number, or says why it can't. */
export function parseWorkerPhone(raw: string | null | undefined): string | null {
    const trimmed = raw?.trim();
    if (!trimmed) {
        return null;
    }
    if (!isValidPhoneNumber(trimmed)) {
        throw new AppError(
            "Enter a valid mobile number, including the area code.",
            "VALIDATION_ERROR",
            400,
        );
    }
    return normalizePhoneNumber(trimmed);
}

export async function findWorkerByPhone(orgId: string, phoneNumber: string) {
    return db.query.worker.findFirst({
        where: and(eq(worker.organizationId, orgId), eq(worker.phoneNumber, phoneNumber)),
    });
}

export function resolveRoles(fields: Pick<WorkerFields, "roles" | "jobTitle">) {
    const roles = resolveWorkerRoleSet({
        roles: fields.roles,
        fallbackRole: fields.jobTitle,
    });
    return { roles, jobTitle: roles[0] ?? fields.jobTitle ?? null };
}

/**
 * Puts a worker on the business's list. Does not invite them: the manager
 * decides when (and whether) to text them the app.
 */
export async function createWorker(orgId: string, data: unknown) {
    const parsed = WorkerFieldsSchema.safeParse(data);
    if (!parsed.success) {
        throw new AppError(
            parsed.error.issues[0]?.message || "Invalid worker",
            "VALIDATION_ERROR",
            400,
            parsed.error.flatten(),
        );
    }

    const input = parsed.data;
    const phoneNumber = parseWorkerPhone(input.phoneNumber);

    if (phoneNumber && (await findWorkerByPhone(orgId, phoneNumber))) {
        throw new AppError(
            "Someone on your list already has this phone number.",
            "WORKER_ALREADY_EXISTS",
            409,
        );
    }

    const { roles, jobTitle } = resolveRoles(input);
    const now = new Date();

    const [created] = await db
        .insert(worker)
        .values({
            id: `wkr_${nanoid()}`,
            organizationId: orgId,
            name: input.name,
            phoneNumber,
            email: input.email?.toLowerCase() ?? null,
            employmentType: input.employmentType ?? "staff",
            agency: input.agency ?? null,
            jobTitle,
            roles,
            hourlyRate: input.hourlyRate ?? null,
            notes: input.notes ?? null,
            status: "added",
            createdAt: now,
            updatedAt: now,
        })
        .returning();

    if (!created) {
        throw new AppError("Failed to add worker", "INTERNAL_ERROR", 500);
    }

    return created;
}
