import { db } from "./src/index";
import { rosterEntry, invitation } from "./src/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

async function backfill() {
    console.log("Fetching invitations...");
    const invites = await db.select().from(invitation);

    for (const invite of invites) {
        // Check if roster entry exists
        const existing = await db.select().from(rosterEntry).where(
            and(
                eq(rosterEntry.email, invite.email),
                eq(rosterEntry.organizationId, invite.organizationId)
            )
        ).limit(1);

        if (!existing[0]) {
            console.log(`Backfilling roster_entry for ${invite.email}...`);
            // Extract a display name from the email (e.g., pavan@test.com -> pavan)
            const fallbackName = invite.email.split('@')[0];

            await db.insert(rosterEntry).values({
                id: nanoid(),
                organizationId: invite.organizationId,
                name: fallbackName,
                email: invite.email,
                role: invite.role || "member",
                status: "invited",
                createdAt: invite.createdAt || new Date()
            });
            console.log(`Created roster_entry for ${invite.email} with name ${fallbackName}`);
        } else {
            console.log(`Skipping ${invite.email} (already exists)`);
        }
    }

    console.log("Done backfilling!");
    process.exit(0);
}

backfill().catch(console.error);
