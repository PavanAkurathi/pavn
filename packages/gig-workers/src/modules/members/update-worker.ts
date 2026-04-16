import { db } from "@repo/database";
import { member } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@repo/observability";

const UpdateWorkerInputSchema = z.object({
    role: z.enum(["admin", "manager", "member"]).optional(),
    jobTitle: z.union([z.string().trim().min(1).max(120), z.null()]).optional(),
    hourlyRate: z.union([z.int().nonnegative().max(1_000_000), z.null()]).optional(),
}).strict().refine((data) => Object.keys(data).length > 0, {
    message: "At least one worker field must be provided.",
});

type UpdateWorkerInput = z.infer<typeof UpdateWorkerInputSchema>;

export const updateWorker = async (data: unknown, id: string, orgId: string) => {
    const parsed = UpdateWorkerInputSchema.safeParse(data);
    if (!parsed.success) {
        throw new AppError("Validation Failed", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const existing = await db.query.member.findFirst({
        where: and(
            eq(member.id, id),
            eq(member.organizationId, orgId)
        )
    });

    if (!existing) {
        throw new AppError("Member not found", "NOT_FOUND", 404);
    }

    const updateData: UpdateWorkerInput = parsed.data;

    const updated = await db
        .update(member)
        .set({
            ...updateData,
            updatedAt: new Date(),
        })
        .where(eq(member.id, id))
        .returning();

    return updated[0];
};
