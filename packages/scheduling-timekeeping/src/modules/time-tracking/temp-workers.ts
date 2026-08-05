import { db } from "@repo/database";
import { tempWorker } from "@repo/database/schema";
import { and, desc, eq } from "drizzle-orm";
import { AppError } from "@repo/observability";
import { z } from "zod";
import { newId } from "../../utils/ids";

const CreateTempWorkersSchema = z
    .object({
        agency: z.string().trim().max(120).optional(),
        // Either explicit names, or a count that generates "Temp 1..N" placeholders.
        names: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
        count: z.number().int().min(1).max(50).optional(),
    })
    .refine((value) => (value.names?.length ?? 0) > 0 || (value.count ?? 0) > 0, {
        error: "Provide names or a count",
    });

const RenameTempWorkerSchema = z.object({
    name: z.string().trim().min(1).max(120),
});

export const listTempWorkers = async (orgId: string) => {
    return db.query.tempWorker.findMany({
        where: eq(tempWorker.organizationId, orgId),
        orderBy: [desc(tempWorker.createdAt)],
    });
};

export const createTempWorkers = async (body: unknown, orgId: string) => {
    const parsed = CreateTempWorkersSchema.safeParse(body);
    if (!parsed.success) {
        throw new AppError("Validation Failed", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const { agency, names, count } = parsed.data;

    let resolvedNames = names ?? [];
    if (resolvedNames.length === 0 && count) {
        // Placeholder numbering continues from the org's existing placeholders
        // so a second batch doesn't produce a duplicate "Temp 1".
        const existing = await listTempWorkers(orgId);
        const taken = new Set(existing.map((t) => t.name));
        let n = 1;
        while (resolvedNames.length < count) {
            const candidate = `Temp ${n}`;
            if (!taken.has(candidate)) resolvedNames.push(candidate);
            n += 1;
        }
    }

    const values = resolvedNames.map((name) => ({
        id: newId("tmp"),
        organizationId: orgId,
        name,
        agency: agency || null,
    }));

    const created = await db.insert(tempWorker).values(values).returning();
    return created;
};

export const renameTempWorker = async (body: unknown, tempWorkerId: string, orgId: string) => {
    const parsed = RenameTempWorkerSchema.safeParse(body);
    if (!parsed.success) {
        throw new AppError("Validation Failed", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const [updated] = await db
        .update(tempWorker)
        .set({ name: parsed.data.name, updatedAt: new Date() })
        .where(and(eq(tempWorker.id, tempWorkerId), eq(tempWorker.organizationId, orgId)))
        .returning();

    if (!updated) {
        throw new AppError("Temp worker not found", "NOT_FOUND", 404);
    }

    return updated;
};
