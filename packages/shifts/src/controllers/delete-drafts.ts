import { db } from "@repo/database";
import { shift } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";

export const deleteDraftsController = async (orgId: string) => {
    await db.delete(shift)
        .where(
            and(
                eq(shift.organizationId, orgId),
                eq(shift.status, 'draft')
            )
        );

    return new Response(JSON.stringify({ success: true, message: "Drafts deleted" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
    });
};
