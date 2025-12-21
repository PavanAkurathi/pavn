import { db } from "@repo/database";
import { sql } from "drizzle-orm";

async function fix() {
    console.log("🩹 Fixing Database Schema...");
    try {
        await db.execute(sql`ALTER TABLE "user" ALTER COLUMN "password" DROP NOT NULL;`);
        console.log("✅ Success: 'password' column is now nullable.");
    } catch (e) {
        console.error("❌ Failed to alter table:", e);
    }
    process.exit(0);
}

fix();
