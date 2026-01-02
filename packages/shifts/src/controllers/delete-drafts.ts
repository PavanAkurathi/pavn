import { db } from "@repo/database";
import { shift } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";

export const deleteDraftsController = async (orgId: string) => {
    try {
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
    } catch (error) {
        console.error("Error deleting drafts:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
};
