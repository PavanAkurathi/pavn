
import { db } from "@repo/database";
import { shift, shiftAssignment, organization, location, user } from "@repo/database/schema";
import { approveShiftController } from "../src/controllers/approve";
import { newId } from "../src/utils/ids";
import { eq } from "drizzle-orm";

async function testAcidApproval() {
    console.log("Starting ACID Approval Concurrency Test...");

    // 1. Setup Data
    let orgId = "org_" + Math.random().toString(36).substring(7);
    let locationId = "loc_" + Math.random().toString(36).substring(7);
    let workerId = "usr_" + Math.random().toString(36).substring(7);

    // STRATEGY: Find any valid location -> use its Org ID.
    const anyLoc = await db.query.location.findFirst();

    if (anyLoc) {
        locationId = anyLoc.id;
        orgId = anyLoc.organizationId;
        console.log("Using existing Location/Org pair:", locationId, orgId);
    } else {
        // Fallback: Check for Org
        const anyOrg = await db.query.organization.findFirst();
        if (anyOrg) {
            orgId = anyOrg.id;
            console.log("Found Org (no location):", orgId);
            try {
                await db.insert(location).values({
                    id: locationId,
                    organizationId: orgId,
                    name: "Test Location Acid",
                    address: "123 Test St",
                    details: {}
                } as any);
            } catch (locErr) { console.warn("Loc insert failed", locErr); }
        }
    }

    // STRATEGY: Find any valid User
    const anyUser = await db.query.user.findFirst();
    if (anyUser) {
        workerId = anyUser.id;
        console.log("Using existing User ID:", workerId);
    } else {
        console.warn("No user found. Test likely fail on FK.");
    }

    const shiftId = newId('shf');
    const assignmentId = newId('asg');

    try {
        console.log("Seeding test data...");

        await db.insert(shift).values({
            id: shiftId,
            organizationId: orgId,
            locationId: locationId,
            title: "Test Shift",
            startTime: new Date(),
            endTime: new Date(),
            capacityTotal: 1,
            status: 'assigned',
            price: 1000,
            scheduleGroupId: "int_" + Math.random().toString(36).substring(7)
        } as any);

        await db.insert(shiftAssignment).values({
            id: assignmentId,
            shiftId: shiftId,
            workerId: workerId,
            status: 'completed'
        } as any);

        console.log("Test data seeded. Launching concurrent requests...");

        // 2. Simulate Concurrent Requests
        // Note: approveShiftController takes (shiftId, orgId) directly.
        // It does NOT parse request body for updates. It audits DB state.

        const p1 = approveShiftController(shiftId, orgId);
        const p2 = approveShiftController(shiftId, orgId);

        const results = await Promise.allSettled([p1, p2]);

        // 3. Verify Results
        const successes = results.filter(r => r.status === 'fulfilled' && r.value.status === 200).length;
        // Check for failures (rejected OR status != 200)
        const failures = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status !== 200)).length;

        console.log(`Results: ${successes} Success, ${failures} Failure`);

        // Log details of failures
        for (const r of results) {
            if (r.status === 'rejected') {
                console.error("Request Rejected:", r.reason);
            } else {
                if (r.value.status !== 200) {
                    try {
                        // Clone res if needed or just read json
                        // Response body can be read once.
                        const body = await r.value.json();
                        console.error(`Request Failed [${r.value.status}]:`, body);
                    } catch (e) {
                        console.error(`Request Failed [${r.value.status}]: (Body read error or not JSON)`);
                    }
                }
            }
        }

        if (successes === 1 && failures === 1) {
            console.log("PASS: concurrency handled correctly (Optimistic Locking worked).");
        } else if (successes === 0) {
            console.error("FAIL: Both requests failed.");
            process.exit(1);
        } else {
            console.error("FAIL: Race condition occurred! Both requests succeeded.");
            process.exit(1);
        }

    } catch (e) {
        console.error("Test Error:", e);
        process.exit(1);
    } finally {
        console.log("Cleaning up...");
        try {
            await db.delete(shiftAssignment).where(eq(shiftAssignment.id, assignmentId));
            await db.delete(shift).where(eq(shift.id, shiftId));
        } catch (cleanupError) {
            console.error("Cleanup Error:", cleanupError);
        }
        process.exit(0);
    }
}

testAcidApproval();
