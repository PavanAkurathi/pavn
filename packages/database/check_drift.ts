import { db } from "./src/index";
import { sql } from "drizzle-orm";

async function checkColumns() {
    console.log("Checking database columns...");

    const queries = [
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'user' AND column_name IN ('emergency_contact', 'address');",
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'shift' AND column_name IN ('contact_id', 'schedule_group_id');",
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'location' AND column_name IN ('geocoded_at', 'geocode_source');"
    ];

    for (const q of queries) {
        const result = await db.execute(sql.raw(q));
        console.log(`Query: ${q}`);
        console.log("Result:", result.rows);
    }
    process.exit(0);
}

checkColumns();
