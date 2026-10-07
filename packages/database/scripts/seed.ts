import { and, eq, like } from "drizzle-orm";
import { db } from "@repo/database";
import { location, member, organization, shift, shiftAssignment, user, worker } from "@repo/database/schema";
import {
    DEV_SEED_ACCOUNTS,
    DEV_SEED_EMAIL_DOMAIN,
    DEV_SEED_ORGANIZATION,
} from "@repo/database/dev-seed";

/**
 * Local-development data: one organization, an owner, three workers and a
 * three weeks of shifts (last, this and next). Safe to run again at any time: accounts are
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
const workerIdFor = (alias: string) => `wkr_dev_${alias}`;

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
                // The business's own record of this person; shifts point at it. Signed in already,
                // so the invite code is not needed.
                await tx
                    .insert(worker)
                    .values({
                        id: workerIdFor(account.alias),
                        organizationId: DEV_SEED_ORGANIZATION.id,
                        userId,
                        name: account.name,
                        phoneNumber: account.phoneNumber ?? null,
                        jobTitle: account.jobTitle,
                        roles: [account.jobTitle],
                        hourlyRate: account.hourlyRateCents ?? null,
                        status: "active",
                        createdAt: now,
                        updatedAt: now,
                    })
                    .onConflictDoNothing();
            }
        }

        // Rebuild the schedule around today. Assignments go with their shifts (cascade).
        await tx
            .delete(shift)
            .where(and(eq(shift.organizationId, DEV_SEED_ORGANIZATION.id), like(shift.id, `${SHIFT_ID_PREFIX}%`)));

        // Last week, this week and next, in the shape of a small restaurant. A shift's title is its
        // role: the Scheduler's Roles board has one row per title.
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // the org's weeks start on Sunday
        weekStart.setHours(0, 0, 0, 0);

        type Pattern = {
            title: string;
            alias: string;
            startHour: number;
            endHour: number;
            /** Days of the week it runs, 0 = Sunday. */
            days: number[];
            /** Weekdays (0 = Sunday) left unstaffed, so there is something to fill. */
            open?: number[];
        };
        const patterns: Pattern[] = [
            { title: "Server", alias: "alex", startHour: 11, endHour: 16, days: [1, 2, 3, 4, 5] },
            { title: "Server", alias: "alex", startHour: 17, endHour: 23, days: [1, 2, 5, 6], open: [5, 6] },
            { title: "Bartender", alias: "sam", startHour: 17, endHour: 23, days: [3, 4, 5, 6, 0] },
            { title: "Host", alias: "jordan", startHour: 17, endHour: 23, days: [4, 5, 6, 0], open: [6] },
        ];

        let n = 0;
        for (const weekOffset of [-1, 0, 1]) {
            for (const pattern of patterns) {
                for (const weekday of pattern.days) {
                    const dayOffset = weekOffset * 7 + weekday;
                    const day = new Date(weekStart);
                    day.setDate(day.getDate() + dayOffset);
                    const start = atHour(day, 0, pattern.startHour);
                    const end = atHour(day, 0, pattern.endHour);
                    const past = end < now;
                    const open = !past && (pattern.open ?? []).includes(weekday);
                    // Two shifts this week are still drafts, so Publish has something to say.
                    const draft = weekOffset === 0 && !past && !open && n % 9 === 4;
                    const id = `${SHIFT_ID_PREFIX}${String(n).padStart(3, "0")}`;

                    await tx.insert(shift).values({
                        id,
                        organizationId: DEV_SEED_ORGANIZATION.id,
                        locationId: LOCATION_ID,
                        title: pattern.title,
                        startTime: start,
                        endTime: end,
                        timezone: DEV_SEED_ORGANIZATION.timezone,
                        capacityTotal: 1,
                        status: past ? "completed" : draft ? "draft" : open ? "published" : "assigned",
                        publishedAt: draft ? null : now,
                        createdAt: now,
                        updatedAt: now,
                    });

                    if (!open) {
                        await tx.insert(shiftAssignment).values({
                            id: `asg_dev_${String(n).padStart(3, "0")}`,
                            shiftId: id,
                            workerId: workerIdFor(pattern.alias),
                            status: "active",
                            // A draft's people are staged too: nobody has been told yet.
                            pendingState: draft ? "add" : null,
                            createdAt: now,
                            updatedAt: now,
                        });
                    }
                    n++;
                }
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
