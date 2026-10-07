import { db } from "@repo/database";
import { worker } from "@repo/database/schema";
import { AppError } from "@repo/observability";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { WorkerFieldsSchema, parseWorkerPhone, resolveRoles } from "./create-worker";

const UpdateWorkerInputSchema = WorkerFieldsSchema.partial().strict().refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one worker field must be provided." },
);

export type UpdateWorkerInput = z.infer<typeof UpdateWorkerInputSchema>;

export const updateWorker = async (data: unknown, id: string, orgId: string) => {
    const parsed = UpdateWorkerInputSchema.safeParse(data);
    if (!parsed.success) {
        throw new AppError("Validation Failed", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const existing = await db.query.worker.findFirst({
        where: and(eq(worker.id, id), eq(worker.organizationId, orgId)),
    });

    if (!existing) {
        throw new AppError("Worker not found", "NOT_FOUND", 404);
    }

    const input = parsed.data;
    const changes: Partial<typeof worker.$inferInsert> = { updatedAt: new Date() };

    if (input.name !== undefined) changes.name = input.name;
    if (input.email !== undefined) changes.email = input.email?.toLowerCase() ?? null;
    if (input.hourlyRate !== undefined) changes.hourlyRate = input.hourlyRate;
    if (input.agency !== undefined) changes.agency = input.agency;
    if (input.notes !== undefined) changes.notes = input.notes;
    if (input.employmentType !== undefined) changes.employmentType = input.employmentType;

    if (input.roles !== undefined || input.jobTitle !== undefined) {
        const resolved = resolveRoles({
            roles: input.roles ?? existing.roles,
            jobTitle: input.jobTitle === undefined ? existing.jobTitle : input.jobTitle,
        });
        changes.roles = resolved.roles;
        changes.jobTitle = resolved.jobTitle;
    }

    if (input.phoneNumber !== undefined) {
        const phoneNumber = parseWorkerPhone(input.phoneNumber);
        if (phoneNumber) {
            const clash = await db.query.worker.findFirst({
                where: and(
                    eq(worker.organizationId, orgId),
                    eq(worker.phoneNumber, phoneNumber),
                    ne(worker.id, id),
                ),
                columns: { id: true },
            });
            if (clash) {
                throw new AppError(
                    "Someone on your list already has this phone number.",
                    "WORKER_ALREADY_EXISTS",
                    409,
                );
            }
        }
        changes.phoneNumber = phoneNumber;
    }

    const [updated] = await db
        .update(worker)
        .set(changes)
        .where(eq(worker.id, id))
        .returning();

    return updated;
};
