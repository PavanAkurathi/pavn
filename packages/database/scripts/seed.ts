import { and, eq, like } from "drizzle-orm";
import { db } from "@repo/database";
import { location, member, organization, shift, shiftAssignment, user, workerRole } from "@repo/database/schema";
import {
    DEV_SEED_ACCOUNTS,
    DEV_SEED_EMAIL_DOMAIN,
    DEV_SEED_ORGANIZATION,
} from "@repo/database/dev-seed";

/**
 * Local-development data: one organization, an owner, three workers and a
 * fortnight of shifts around today. Safe to run again at any time: accounts are
 * upserted and the shifts are rebuilt relative to today, so the Scheduler is
 * never empty and never stale.
 *
 * Sign in as any of them with the dev sign-in link, e.g.
 *   /api/auth/dev-login?token=…&as=owner&next=/schedule
 */

const SHIFT_ID_PREFIX = "shift_dev_";
const LOCATION_ID = "loc_dev_seed";

const userIdFor = (alias: string) => `usr_dev_${alias}`;
const memberIdFor = (alias: string) => `mem_dev_${alias}`;

function assertSafeToSeed() {
    if (process.env.NODE_ENV === "production") {
        throw new Error("Refusing to seed with NODE_ENV=production.");
    }
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is not set. Run through `bun run db:seed` so .env is loaded.");
    }
}

function atHour(base: Date, dayOffset: number, hour: number): Date {
    const date = new Date(base);
    date.setDate(date.getDate() + dayOffset);
    date.setHours(hour, 0, 0, 0);
    return date;
}

export async function seed() {
    assertSafeToSeed();
    const now = new Date();

    await db.transaction(async (tx) => {
        await tx
            .insert(organization)
            .values({
                id: DEV_SEED_ORGANIZATION.id,
                name: DEV_SEED_ORGANIZATION.name,
                slug: DEV_SEED_ORGANIZATION.slug,
                timezone: DEV_SEED_ORGANIZATION.timezone,
                // Paying, so the trial banner never nags in dev.
                subscriptionStatus: "active",
                createdAt: now,
            })
            .onConflictDoUpdate({
                target: organization.id,
                set: { name: DEV_SEED_ORGANIZATION.name, subscriptionStatus: "active" },
            });

        await tx
            .insert(location)
            .values({
                id: LOCATION_ID,
                organizationId: DEV_SEED_ORGANIZATION.id,
                name: "Downtown Venue",
                slug: "downtown-venue",
                timezone: DEV_SEED_ORGANIZATION.timezone,
                address: "350 5th Ave, New York, NY",
                zip: "10118",
                position: { lat: 40.7484, lng: -73.9857 },
                geofenceRadius: 100,
                geocodeSource: "manual",
                createdAt: now,
                updatedAt: now,
            })
            .onConflictDoNothing();

        for (const account of DEV_SEED_ACCOUNTS) {
            const userId = userIdFor(account.alias);
            const isWorker = account.memberRole === "member";

            await tx
                .insert(user)
                .values({
                    id: userId,
                    name: account.name,
                    email: `${account.alias}@${DEV_SEED_EMAIL_DOMAIN}`,
                    // Verified, or the web proxy bounces every request to /verify-email.
                    emailVerified: true,
                    phoneNumber: account.phoneNumber ?? null,
                    role: isWorker ? "worker" : "admin",
                    timezone: DEV_SEED_ORGANIZATION.timezone,
                    createdAt: now,
                    updatedAt: now,
                })
                .onConflictDoUpdate({
                    target: user.id,
                    set: { name: account.name, emailVerified: true, updatedAt: now },
                });

            await tx
                .insert(member)
                .values({
                    id: memberIdFor(account.alias),
                    organizationId: DEV_SEED_ORGANIZATION.id,
                    userId,
                    role: account.memberRole,
                    status: "active",
                    hourlyRate: account.hourlyRateCents ?? null,
                    jobTitle: account.jobTitle,
                    createdAt: now,
                })
                .onConflictDoNothing();

            if (isWorker) {
                await tx
                    .insert(workerRole)
                    .values({
                        id: `wrole_dev_${account.alias}`,
                        workerId: userId,
                        organizationId: DEV_SEED_ORGANIZATION.id,
                        role: account.jobTitle,
                        hourlyRate: account.hourlyRateCents ?? null,
                    })
                    .onConflictDoNothing();
            }
        }

        // Rebuild the schedule around today. Assignments go with their shifts (cascade).
        await tx
            .delete(shift)
            .where(and(eq(shift.organizationId, DEV_SEED_ORGANIZATION.id), like(shift.id, `${SHIFT_ID_PREFIX}%`)));

        const workers = DEV_SEED_ACCOUNTS.filter((account) => account.memberRole === "member");
        if (workers.length === 0) {
            throw new Error("DEV_SEED_ACCOUNTS has no workers to schedule.");
        }
        let n = 0;

        // Yesterday through next week: one lunch and one dinner shift a day.
        for (let dayOffset = -1; dayOffset <= 7; dayOffset++) {
            for (const [title, startHour, endHour] of [
                ["Lunch service", 11, 16],
                ["Dinner service", 17, 23],
            ] as const) {
                const worker = workers[n % workers.length]!;
                const id = `${SHIFT_ID_PREFIX}${String(n).padStart(3, "0")}`;
                const start = atHour(now, dayOffset, startHour);
                const past = dayOffset < 0;
                // Every fourth future shift is left open so the Scheduler has something to fill.
                const open = !past && n % 4 === 3;

                await tx.insert(shift).values({
                    id,
                    organizationId: DEV_SEED_ORGANIZATION.id,
                    locationId: LOCATION_ID,
                    title,
                    startTime: start,
                    endTime: atHour(now, dayOffset, endHour),
                    timezone: DEV_SEED_ORGANIZATION.timezone,
                    capacityTotal: 1,
                    status: past ? "completed" : open ? "published" : "assigned",
                    publishedAt: now,
                    createdAt: now,
                    updatedAt: now,
                });

                if (!open) {
                    await tx.insert(shiftAssignment).values({
                        id: `asg_dev_${String(n).padStart(3, "0")}`,
                        shiftId: id,
                        workerId: userIdFor(worker.alias),
                        status: "active",
                        createdAt: now,
                        updatedAt: now,
                    });
                }
                n++;
            }
        }
    });

    console.log(`✅ Seeded ${DEV_SEED_ORGANIZATION.name}`);
    for (const account of DEV_SEED_ACCOUNTS) {
        console.log(`   ${account.alias.padEnd(7)} ${account.alias}@${DEV_SEED_EMAIL_DOMAIN}${account.phoneNumber ? `  ${account.phoneNumber}` : ""}`);
    }
}

// Run directly (`bun run db:seed`); importing it from reset.ts must not.
if (import.meta.main) {
    seed()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("❌ Seed failed:", error);
            process.exit(1);
        });
}
