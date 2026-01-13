import { db } from "@repo/database";
import { sql } from "drizzle-orm";

async function reset() {
    console.log("🧨 RESETTING DATABASE...");
    console.log("⚠️  This will delete ALL data. Press Ctrl+C in 3 seconds to cancel.");

    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
        // We use CASCADE to handle foreign key constraints automatically
        // This is a "Nuke it all" approach suitable for development reset
        await db.execute(sql`
            TRUNCATE TABLE 
                "shift_assignment",
                "worker_location",
                "shift",
                "certification",
                "invitation",
                "member",
                "organization",
                "session",
                "account",
                "user",
                "verification",
                "time_correction_request"
            CASCADE;
        `);
        console.log("✅ Database successfully wiped.");
    } catch (e) {
        console.error("❌ Failed to reset database:", e);
    }
    process.exit(0);
}

reset();
