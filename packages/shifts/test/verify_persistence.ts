
import { db } from "@repo/database";
import { shift } from "@repo/database/schema";
import { desc } from "drizzle-orm";

async function checkLatestShifts() {
    console.log("Checking for recently created shifts...");

    const latest = await db.query.shift.findMany({
        orderBy: [desc(shift.createdAt)],
        limit: 5,
        with: {
            organization: true
        }
    });

    if (latest.length === 0) {
        console.log("No shifts found in database.");
    } else {
        console.log(`Found ${latest.length} recent shifts:`);
        latest.forEach(s => {
            console.log(`- ID: ${s.id}`);
            console.log(`  Title: ${s.title}`);
            console.log(`  Status: ${s.status}`);
            console.log(`  Org ID: ${s.organizationId}`);
            console.log(`  Created: ${s.createdAt}`);
            console.log("---");
        });
    }

    process.exit(0);
}

checkLatestShifts();
