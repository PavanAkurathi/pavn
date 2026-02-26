import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

// Initialize Neon HTTP client
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");
const sql = neon(dbUrl);
const db = drizzle(sql);

async function run() {
    const result = await sql`SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at;`;
    console.log("Migrations in DB:");
    console.table(result);
}

run().catch(console.error);
