import { db } from "@repo/database";
import { sql } from "drizzle-orm";

async function check() {
    console.log("🔍 Checking Database Counts...");
    try {
        const userCount = await db.execute(sql`SELECT COUNT(*) FROM "user"`);
        const sessionCount = await db.execute(sql`SELECT COUNT(*) FROM "session"`);
        const orgCount = await db.execute(sql`SELECT COUNT(*) FROM "organization"`);

        console.log("Users:", userCount.rows[0].count);
        console.log("Sessions:", sessionCount.rows[0].count);
        console.log("Organizations:", orgCount.rows[0].count);
    } catch (e) {
        console.error("❌ Failed to check database:", e);
    }
    process.exit(0);
}

check();
