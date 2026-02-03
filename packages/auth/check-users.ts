// packages/auth/check-users.ts
// testing
import { db } from "@repo/database";
import { user } from "@repo/database/schema";

async function main() {
    const users = await db.select().from(user);
    console.log("Users in DB:", users);
    process.exit(0);
}

main().catch(console.error);
