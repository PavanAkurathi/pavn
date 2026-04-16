import { db } from "@repo/database";
import { user } from "@repo/database/schema";
import { eq } from "drizzle-orm";
import { AppError } from "@repo/observability";
import { z } from "zod";

const UpdateWorkerProfileSchema = z.object({
    name: z.string().optional(),
    image: z.string().optional(),
});

export async function updateWorkerProfile(userId: string, payload: unknown) {
    const parsed = UpdateWorkerProfileSchema.safeParse(payload);
    if (!parsed.success) {
        throw new AppError("Invalid request", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const allowedFields: Record<string, string> = {};
    if (parsed.data.name && typeof parsed.data.name === "string") {
        allowedFields.name = parsed.data.name;
    }
    if (parsed.data.image && typeof parsed.data.image === "string") {
        allowedFields.image = parsed.data.image;
    }

    if (Object.keys(allowedFields).length === 0) {
        throw new AppError("No valid fields to update", "VALIDATION_ERROR", 400);
    }

    const [updated] = await db.update(user)
        .set({ ...allowedFields, updatedAt: new Date() })
        .where(eq(user.id, userId))
        .returning();

    if (!updated) {
        throw new AppError("Worker not found", "NOT_FOUND", 404);
    }

    return updated;
}
