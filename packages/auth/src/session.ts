// packages/auth/src/session.ts

import { db } from "@repo/database";
import * as schema from "@repo/database/schema";
import { eq } from "drizzle-orm";

export type SessionContext = {
    activeOrgId: string | null;  // null = "show all orgs"
    orgIds: string[];             // all orgs this worker belongs to
};

// The mobile app calls this after phone verification
// to set the initial org context from the deep link
export async function setWorkerOrgContext(
    sessionId: string,
    orgId: string
): Promise<void> {
    // Update session metadata with org context
    await db
        .update(schema.session)
        .set({
            activeOrganizationId: orgId,
        })
        .where(eq(schema.session.id, sessionId));
}
