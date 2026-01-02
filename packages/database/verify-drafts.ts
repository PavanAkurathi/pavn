
import { db } from "./src/index";
import { shift } from "./src/schema";
import { eq } from "drizzle-orm";

async function main() {
    console.log("Checking for drafts...");
    const drafts = await db.select().from(shift).where(eq(shift.status, "draft"));
    console.log(`Found ${drafts.length} drafts.`);
    if (drafts.length > 0) {
        console.log("Sample draft:", JSON.stringify(drafts[0], null, 2));
    }
    process.exit(0);
}

main().catch(console.error);
