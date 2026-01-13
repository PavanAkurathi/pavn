import { db } from "@repo/database";
import { sql } from "drizzle-orm";

async function checkMembers() {
    console.log("🔍 Checking Members...");
    try {
        const members = await db.execute(sql`
            SELECT 
                m.id as member_id, 
                m.role, 
                u.name, 
                u.email, 
                u.phone_number 
            FROM "member" m
            JOIN "user" u ON m.user_id = u.id
        `);
        console.table(members.rows);
    } catch (e) {
        console.error("❌ Failed to check members:", e);
    }
    process.exit(0);
}

checkMembers();
