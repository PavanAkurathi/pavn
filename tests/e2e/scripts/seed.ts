import { fetch } from "bun";
import { db, eq } from "@repo/database";
import { user, member } from "@repo/database/schema";

const API_URL = process.env.API_URL || "http://localhost:4005";
const ADMIN = {
    email: "admin@test.workershive.com",
    password: "TestPassword123!",
    name: "Test Admin",
    companyName: "Test Organization"
};

async function seed() {
    console.log(`Seeding admin user to ${API_URL}...`);

    try {
        let userId: string | undefined;

        const response = await fetch(`${API_URL}/api/auth/sign-up/email`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(ADMIN)
        });

        if (response.ok) {
            console.log("✅ Admin user seeded successfully");
            const data = await response.json();
            userId = data.user?.id;
            console.log("User ID:", userId);
        } else {
            const text = await response.text();
            if (text.includes("User already exists")) {
                console.log("⚠️ User already exists, fetching ID to verify email...");
                // Fetch user from DB to get ID
                const existingUser = await db.query.user.findFirst({
                    where: eq(user.email, ADMIN.email)
                });
                userId = existingUser?.id;
            } else {
                console.error("❌ Failed to seed user:", response.status, text);
                process.exit(1);
            }
        }

        if (userId) {
            console.log(`Forcing email verification for user ${userId}...`);
            await db.update(user)
                .set({ emailVerified: true })
                .where(eq(user.id, userId));
            console.log("✅ Email verified successfully");

            // Find Organization ID
            const adminMember = await db.query.member.findFirst({
                where: eq(member.userId, userId),
                with: {
                    organization: true
                }
            });

            if (adminMember?.organizationId) {
                const orgId = adminMember.organizationId;
                console.log(`Found Organization: ${orgId}`);

                // Seed Worker
                const WORKER_EMAIL = "worker@test.workershive.com";
                const existingWorker = await db.query.user.findFirst({
                    where: eq(user.email, WORKER_EMAIL)
                });

                let workerId = existingWorker?.id;

                if (!existingWorker) {
                    console.log("Seeding worker user...");
                    workerId = crypto.randomUUID();

                    await db.insert(user).values({
                        id: workerId,
                        name: "Test Worker",
                        email: WORKER_EMAIL,
                        emailVerified: true,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    });

                    // Add to Organization
                    await db.insert(member).values({
                        id: crypto.randomUUID(),
                        userId: workerId,
                        organizationId: orgId,
                        role: "member",
                        status: "active",
                        hourlyRate: 2000, // $20.00
                        jobTitle: "General Staff",
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    });
                    console.log("✅ Worker seeded successfully");
                } else {
                    console.log("Worker already exists");
                }
            } else {
                console.error("❌ Could not find organization for admin user");
            }
        }

    } catch (error) {
        console.error("❌ Network error seeding:", error);
        process.exit(1);
    }
}

seed();
