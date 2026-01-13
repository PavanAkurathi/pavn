import { db } from "@repo/database";
import { member, user } from "@repo/database/schema";
import { randomUUID } from "crypto";

async function simulate() {
    console.log("🤖 Simulating Invite...");

    // 1. Get first Org
    const org = await db.query.organization.findFirst();
    if (!org) {
        console.error("❌ No Organization found! Create one in the UI first.");
        process.exit(1);
    }
    console.log(`✅ Using Org: ${org.name} (${org.id})`);

    // 2. Create Shadow User
    const email = `worker-${randomUUID().slice(0, 4)}@test.com`;
    const userId = randomUUID();

    console.log(`Creating User: ${email}`);
    await db.insert(user).values({
        id: userId,
        name: "Test Worker",
        email: email,
        emailVerified: false,
        phoneNumber: "+15550001234",
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    // 3. Create Member
    console.log(`Creating Member link...`);
    await db.insert(member).values({
        id: randomUUID(),
        organizationId: org.id,
        userId: userId,
        role: "member",
        createdAt: new Date(),
    });

    console.log("✅ Simulation Complete. Check DB now.");
    process.exit(0);
}

simulate();
