import { db } from "@repo/database";
import { sql } from "drizzle-orm";
import { seed } from "./seed";

/**
 * Wipes every table, then re-seeds the dev accounts so you land on a working
 * workspace instead of the signup screen. Pass --no-seed for an empty database.
 */
async function reset() {
    if (process.env.NODE_ENV === "production") {
        console.error("❌ Refusing to reset with NODE_ENV=production.");
        process.exit(1);
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error("❌ DATABASE_URL is not set. Run through `bun run db:reset` so .env is loaded.");
        process.exit(1);
    }

    // Name the target: a Neon database used by a shared deployment looks just like a local one.
    let target = "the configured database";
    try {
        target = new URL(databaseUrl).host;
    } catch {
        // Not a parseable URL; fall back to the generic wording.
    }

    console.log("🧨 RESETTING DATABASE...");
    console.log(`⚠️  This will delete ALL data in ${target}. Press Ctrl+C in 3 seconds to cancel.`);

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

        if (!process.argv.includes("--no-seed")) {
            await seed();
        }
    } catch (e) {
        console.error("❌ Failed to reset database:", e);
        process.exit(1);
    }
    process.exit(0);
}

reset();
