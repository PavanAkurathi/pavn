import { db } from "./src/index";
import { rosterEntry, invitation, member, user } from "./src/schema";

async function check() {
    console.log("--- Roster Entries ---");
    const entries = await db.select().from(rosterEntry);
    console.log(entries);

    console.log("\n--- Invitations ---");
    const invites = await db.select().from(invitation);
    console.log(invites);

    console.log("\n--- Members ---");
    const members = await db.select().from(member);
    console.log(members);

    console.log("\n--- Users ---");
    const users = await db.select().from(user);
    console.log(users);

    process.exit(0);
}

check().catch(console.error);
