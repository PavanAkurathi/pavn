import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

const dbUrl = "***REMOVED***";

async function run() {
    const sql = neon(dbUrl);
    const db = drizzle(sql);
    const result = await sql`SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at;`;
    console.log("Migrations in DB:");
    console.table(result);
}

run().catch(console.error);
