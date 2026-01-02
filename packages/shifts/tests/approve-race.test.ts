import { describe, expect, test, afterAll } from "bun:test";
import { approveShiftController } from "../src/controllers/approve";
import { db } from "@repo/database";
import { shift, organization } from "@repo/database/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

const orgId = `org_${nanoid()}`;
const shiftId = `shf_${nanoid()}`;

describe("approveShiftController Race Condition", () => {
    test("successfully approves a 'completed' shift (Fixed SHIFT-001)", async () => {
        // 1. Setup: Insert Organization
        await db.insert(organization).values({
            id: orgId,
            name: "Test Org",
            slug: orgId,
            createdAt: new Date(),
        });

        // 2. Setup: Insert a 'completed' shift
        const start = new Date();
        const end = new Date(start.getTime() + 4 * 60 * 60 * 1000); // 4 hours

        await db.insert(shift).values({
            id: shiftId,
            organizationId: orgId,
            locationId: null,
            scheduleGroupId: `int_${nanoid()}`,
            title: "Test Race Shift",
            startTime: start,
            endTime: end,
            status: "completed", // The critical state that trips the bug
            price: 100, // 1 dollar/hr
        });

        // 3. Action: Attempt to approve
        const response = await approveShiftController(shiftId, orgId);

        // 4. Assertion: Should succeed now
        expect(response.status).toBe(200);
        const body = await response.json() as any;
        expect(body.success).toBe(true);
    });

    afterAll(async () => {
        await db.delete(organization).where(eq(organization.id, orgId));
    });
});
