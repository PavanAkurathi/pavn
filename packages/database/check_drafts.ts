
import { db } from "./src/db";
import { shift } from "./src/schema";
import { eq } from "drizzle-orm";

async function main() {
    console.log("Checking for draft shifts...");
    try {
        const drafts = await db.select().from(shift).where(eq(shift.status, "draft"));

        if (drafts.length === 0) {
            console.log("No draft shifts found.");
        } else {
            console.log(`Found ${drafts.length} draft shifts:`);
            console.table(drafts.map(d => ({
                id: d.id,
                title: d.title,
                status: d.status,
                start: d.startTime
            })));
        }
    } catch (e) {
        console.error("Error checking drafts:", e);
    }
    process.exit(0);
}

main();
