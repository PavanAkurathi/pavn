import { db } from "@repo/database";
import { user } from "@repo/database/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const UpdateWorkerProfileSchema = z.object({
    name: z.string().optional(),
    image: z.string().optional(),
});

export async function updateWorkerProfile(userId: string, payload: unknown) {
    const parsed = UpdateWorkerProfileSchema.safeParse(payload);
    if (!parsed.success) {
        throw new Error("Invalid request");
    }

    const allowedFields: Record<string, string> = {};
    if (parsed.data.name && typeof parsed.data.name === "string") {
        allowedFields.name = parsed.data.name;
    }
    if (parsed.data.image && typeof parsed.data.image === "string") {
        allowedFields.image = parsed.data.image;
    }

    if (Object.keys(allowedFields).length === 0) {
        throw new Error("No valid fields to update");
    }

    const [updated] = await db.update(user)
        .set({ ...allowedFields, updatedAt: new Date() })
        .where(eq(user.id, userId))
        .returning();

    return updated ?? null;
}
