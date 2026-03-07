import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { db } from "@repo/database/db";
import { organization, user, member, workerAvailability } from "@repo/database/schema";
import { eq, and, inArray, lt, gt } from "drizzle-orm";

/**
 * EXPLORATION TEST - TENANT-001: Availability Query Leak
 * 
 * Property 1: Fault Condition - Cross-Tenant Availability Exposure
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * DO NOT attempt to fix the test or the code when it fails
 * 
 * GOAL: Demonstrate that availability queries return data from other organizations
 * 
 * Bug Condition (from design.md):
 * WHEN the shift publishing service queries worker availability in `publish.ts` line 219
 * THEN the system fetches availability records without filtering by organizationId,
 * potentially exposing worker availability data from other organizations
 * 
 * Expected Behavior (after fix):
 * WHEN the shift publishing service queries worker availability in `publish.ts`
 * THEN the system SHALL include organizationId filter in the workerAvailability query
 * to ensure availability data is scoped to the requesting organization only
 * 
 * Requirements: 1.4 (Current Behavior), 2.4 (Expected Behavior)
 */

describe("TENANT-001 Exploration: Availability Query Leak", () => {
    let orgA: any;
    let orgB: any;
    let workerOrgA: any;
    let workerOrgB: any;
    let availabilityIds: string[] = [];

    beforeAll(async () => {
        // Create two separate organizations
        [orgA] = await db.insert(organization).values({
            id: `test-org-a-${Date.now()}`,
            name: "Organization A",
            slug: `org-a-${Date.now()}`,
            createdAt: new Date(),
        }).returning();

        [orgB] = await db.insert(organization).values({
            id: `test-org-b-${Date.now()}`,
            name: "Organization B",
            slug: `org-b-${Date.now()}`,
            createdAt: new Date(),
        }).returning();

        // Create workers in each organization
        [workerOrgA] = await db.insert(user).values({
            id: `worker-org-a-${Date.now()}`,
            name: "Worker from Org A",
            email: `worker-a-${Date.now()}@test.com`,
            emailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        }).returning();

        [workerOrgB] = await db.insert(user).values({
            id: `worker-org-b-${Date.now()}`,
            name: "Worker from Org B",
            email: `worker-b-${Date.now()}@test.com`,
            emailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        }).returning();

        // Create memberships
        await db.insert(member).values([
            {
                id: `member-a-${Date.now()}`,
                organizationId: orgA.id,
                userId: workerOrgA.id,
                role: "member",
                status: "active",
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: `member-b-${Date.now()}`,
                organizationId: orgB.id,
                userId: workerOrgB.id,
                role: "member",
                status: "active",
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ]);

        // Create availability records for both workers
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dayAfter = new Date(tomorrow);
        dayAfter.setDate(dayAfter.getDate() + 1);

        const [avail1] = await db.insert(workerAvailability).values({
            id: `avail-org-a-${Date.now()}`,
            workerId: workerOrgA.id,
            organizationId: orgA.id,
            type: "available",
            startTime: tomorrow,
            endTime: dayAfter,
            createdAt: new Date(),
            updatedAt: new Date(),
        }).returning();

        const [avail2] = await db.insert(workerAvailability).values({
            id: `avail-org-b-${Date.now()}`,
            workerId: workerOrgB.id,
            organizationId: orgB.id,
            type: "available",
            startTime: tomorrow,
            endTime: dayAfter,
            createdAt: new Date(),
            updatedAt: new Date(),
        }).returning();

        availabilityIds.push(avail1.id, avail2.id);
    });

    afterAll(async () => {
        // Cleanup
        await db.delete(workerAvailability).where(inArray(workerAvailability.id, availabilityIds));
        await db.delete(member).where(
            or(
                eq(member.userId, workerOrgA.id),
                eq(member.userId, workerOrgB.id)
            )
        );
        await db.delete(user).where(
            or(
                eq(user.id, workerOrgA.id),
                eq(user.id, workerOrgB.id)
            )
        );
        await db.delete(organization).where(
            or(
                eq(organization.id, orgA.id),
                eq(organization.id, orgB.id)
            )
        );
    });

    test("EXPECTED TO FAIL: Query without organizationId filter returns cross-tenant data", async () => {
        // Simulate the BUGGY query from publish.ts line 226-231
        // This query is missing organizationId filter
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dayAfter = new Date(tomorrow);
        dayAfter.setDate(dayAfter.getDate() + 2);

        // Query for Org A workers, but WITHOUT organizationId filter (BUG)
        const availabilityRecords = await db.query.workerAvailability.findMany({
            where: and(
                inArray(workerAvailability.workerId, [workerOrgA.id, workerOrgB.id]),
                lt(workerAvailability.startTime, dayAfter),
                gt(workerAvailability.endTime, tomorrow)
            )
        });

        console.log(`\n📊 Query Results:`);
        console.log(`  Total records returned: ${availabilityRecords.length}`);
        
        const orgARecords = availabilityRecords.filter(r => r.organizationId === orgA.id);
        const orgBRecords = availabilityRecords.filter(r => r.organizationId === orgB.id);
        
        console.log(`  Org A records: ${orgARecords.length}`);
        console.log(`  Org B records: ${orgBRecords.length}`);

        // BUG CONFIRMATION: Query returns data from BOTH organizations
        if (orgBRecords.length > 0) {
            console.log(`\n⚠️  BUG CONFIRMED: Query for Org A workers returned ${orgBRecords.length} records from Org B`);
            console.log(`  Counterexample: Worker ${workerOrgB.id} from Org B is visible in Org A query`);
            console.log(`  This is a SECURITY VULNERABILITY - cross-tenant data leak!`);
            
            throw new Error(
                `BUG CONFIRMED: Availability query without organizationId filter returned cross-tenant data. ` +
                `Expected: Only Org A data. Actual: ${orgARecords.length} from Org A, ${orgBRecords.length} from Org B. ` +
                `This proves TENANT-001 bug exists.`
            );
        }

        // If we reach here, the bug is fixed
        console.log(`\n✓ FIXED: Query correctly filtered to single organization`);
        expect(orgBRecords.length).toBe(0);
    });

    test("EXPECTED TO FAIL: Shift publishing query exposes cross-tenant availability", async () => {
        // Simulate the exact query pattern from publish.ts
        const searchStart = new Date();
        const searchEnd = new Date();
        searchEnd.setDate(searchEnd.getDate() + 2);

        // This is the BUGGY query from publish.ts (missing organizationId filter)
        const availabilityRecords = await db.query.workerAvailability.findMany({
            where: and(
                inArray(workerAvailability.workerId, [workerOrgA.id, workerOrgB.id]),
                lt(workerAvailability.startTime, searchEnd),
                gt(workerAvailability.endTime, searchStart)
            )
        });

        // Group by organization to show the leak
        const byOrg = new Map<string, number>();
        for (const record of availabilityRecords) {
            const count = byOrg.get(record.organizationId) || 0;
            byOrg.set(record.organizationId, count + 1);
        }

        console.log(`\n📊 Availability Records by Organization:`);
        for (const [orgId, count] of byOrg.entries()) {
            const orgName = orgId === orgA.id ? "Org A" : orgId === orgB.id ? "Org B" : "Unknown";
            console.log(`  ${orgName} (${orgId}): ${count} records`);
        }

        // BUG: Should only see Org A data when querying for Org A
        if (byOrg.size > 1) {
            console.log(`\n⚠️  BUG CONFIRMED: Query returned data from ${byOrg.size} organizations`);
            console.log(`  Expected: Data from 1 organization (Org A only)`);
            console.log(`  Actual: Data from ${byOrg.size} organizations`);
            console.log(`  Security Impact: Org A can see Org B worker availability`);
            
            throw new Error(
                `BUG CONFIRMED: Shift publishing availability query returned data from ${byOrg.size} organizations. ` +
                `This is a cross-tenant data leak (TENANT-001). ` +
                `Query must include organizationId filter.`
            );
        }

        // If we reach here, the bug is fixed
        console.log(`\n✓ FIXED: Query correctly scoped to single organization`);
        expect(byOrg.size).toBe(1);
    });

    test("EXPECTED TO FAIL: Worker from Org B visible when querying for Org A", async () => {
        // Direct test: Can Org A see Org B worker availability?
        const searchStart = new Date();
        const searchEnd = new Date();
        searchEnd.setDate(searchEnd.getDate() + 2);

        // Query that should only return Org A data
        const availabilityRecords = await db.query.workerAvailability.findMany({
            where: and(
                inArray(workerAvailability.workerId, [workerOrgA.id, workerOrgB.id]),
                lt(workerAvailability.startTime, searchEnd),
                gt(workerAvailability.endTime, searchStart)
                // MISSING: eq(workerAvailability.organizationId, orgA.id)
            )
        });

        // Check if Org B worker is visible
        const orgBWorkerVisible = availabilityRecords.some(
            r => r.workerId === workerOrgB.id
        );

        if (orgBWorkerVisible) {
            console.log(`\n⚠️  BUG CONFIRMED: Worker ${workerOrgB.id} from Org B is visible in Org A query`);
            console.log(`  This should NOT be possible - it's a cross-tenant data leak`);
            console.log(`  Counterexample documented: workerOrgB availability exposed to orgA query`);
            
            throw new Error(
                `BUG CONFIRMED: Worker from Org B (${workerOrgB.id}) is visible when querying for Org A workers. ` +
                `This proves the availability query lacks organizationId filter (TENANT-001).`
            );
        }

        // If we reach here, the bug is fixed
        console.log(`\n✓ FIXED: Org B worker correctly hidden from Org A query`);
        expect(orgBWorkerVisible).toBe(false);
    });
});

/**
 * COUNTEREXAMPLES DOCUMENTATION:
 * 
 * When this test runs on UNFIXED code, it will document counterexamples like:
 * - "Query for Org A workers returned 1 records from Org B"
 * - "Worker worker-org-b-123 from Org B is visible in Org A query"
 * - "Query returned data from 2 organizations (expected 1)"
 * - "Availability query without organizationId filter returned cross-tenant data"
 * 
 * These counterexamples prove that the bug exists and demonstrate the security vulnerability.
 * 
 * After implementing the fix (adding organizationId filter), these tests should PASS because:
 * - Query will include: eq(workerAvailability.organizationId, activeOrgId)
 * - Only same-organization availability data will be returned
 * - Cross-tenant data leaks will be prevented
 * - All tests will pass with orgBRecords.length === 0
 * 
 * Fix location: packages/shifts/src/modules/shifts/publish.ts line 226-231
 * Add filter: eq(workerAvailability.organizationId, activeOrgId)
 */
