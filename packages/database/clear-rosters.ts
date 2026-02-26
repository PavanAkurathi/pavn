import { db } from "./src/index";
import { rosterEntry, invitation } from "./src/schema";
import { eq, or, and } from "drizzle-orm";

async function clearRosters() {
    console.log("Deleting existing roster entries...");
    await db.delete(rosterEntry);

    console.log("Deleting existing pending invitations...");
    // Only delete pending invitations so we don't break active users
    await db.delete(invitation).where(eq(invitation.status, "pending"));

    console.log("Cleanup complete!");
    process.exit(0);
}

clearRosters().catch(console.error);
