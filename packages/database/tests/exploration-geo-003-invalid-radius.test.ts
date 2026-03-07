import { describe, expect, test, beforeAll } from "bun:test";
import { db } from "../src/db";
import { location, organization } from "../src/schema";
import { eq } from "drizzle-orm";

/**
 * EXPLORATION TEST - GEO-003: Invalid Geofence Radius
 * 
 * Property 1: Fault Condition - Invalid Geofence Radius Acceptance
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * DO NOT attempt to fix the test or the code when it fails
 * 
 * GOAL: Surface counterexamples demonstrating invalid radius values are accepted
 * 
 * Bug Condition (from design.md):
 * WHEN an admin sets a geofence radius in the location table
 * THEN the system accepts any integer value without min/max constraints,
 * allowing invalid values like 0 meters or 10000 meters that break geofence validation logic
 * 
 * Expected Behavior (after fix):
 * WHEN an admin sets a geofence radius in the location table
 * THEN the system SHALL enforce database-level constraints (CHECK constraint)
 * ensuring geofenceRadius is between 10 and 500 meters
 * 
 * Requirements: 1.9 (Current Behavior), 2.9 (Expected Behavior)
 */

describe("GEO-003 Exploration: Invalid Geofence Radius Acceptance", () => {
    let testOrgId: string;

    beforeAll(async () => {
        // Create test organization
        const [org] = await db.insert(organization).values({
            id: `test-org-geo-003-${Date.now()}`,
            name: "Test Org for GEO-003",
            slug: `test-org-geo-003-${Date.now()}`,
            createdAt: new Date(),
            updatedAt: new Date(),
        }).returning();
        testOrgId = org.id;
    });

    test("EXPECTED TO FAIL: System accepts geofence radius = 0 meters", async () => {
        // Attempt to create location with invalid radius = 0
        const locationId = `test-location-radius-0-${Date.now()}`;
        
        try {
            const [loc] = await db.insert(location).values({
                id: locationId,
                organizationId: testOrgId,
                name: "Test Location - Radius 0",
                slug: `test-location-radius-0-${Date.now()}`,
                timezone: "UTC",
                geofenceRadius: 0, // INVALID: Should be rejected but isn't
                createdAt: new Date(),
                updatedAt: new Date(),
            }).returning();

            // If we reach here, the bug exists - invalid value was accepted
            expect(loc.geofenceRadius).toBe(0);
            
            // Clean up
            await db.delete(location).where(eq(location.id, locationId));
            
            // This test SHOULD FAIL because the system accepts invalid radius
            // After fix, this insert should throw a constraint violation error
            throw new Error(
                "BUG CONFIRMED: System accepted geofence radius = 0 meters. " +
                "This should be rejected by CHECK constraint (radius >= 10 AND radius <= 500)"
            );
        } catch (error: any) {
            // If we get a constraint violation error, the bug is fixed
            if (error.code === '23514') { // check_violation
                // Bug is fixed - constraint is working
                expect(error.message).toContain("check_geofence_radius_range");
                return;
            }
            // Re-throw if it's our bug confirmation error
            throw error;
        }
    });

    test("EXPECTED TO FAIL: System accepts geofence radius = 5 meters", async () => {
        const locationId = `test-location-radius-5-${Date.now()}`;
        
        try {
            const [loc] = await db.insert(location).values({
                id: locationId,
                organizationId: testOrgId,
                name: "Test Location - Radius 5",
                slug: `test-location-radius-5-${Date.now()}`,
                timezone: "UTC",
                geofenceRadius: 5, // INVALID: Below minimum of 10
                createdAt: new Date(),
                updatedAt: new Date(),
            }).returning();

            expect(loc.geofenceRadius).toBe(5);
            await db.delete(location).where(eq(location.id, locationId));
            
            throw new Error(
                "BUG CONFIRMED: System accepted geofence radius = 5 meters (below minimum of 10). " +
                "Counterexample: location with radius=5 was successfully created."
            );
        } catch (error: any) {
            if (error.code === '23514') {
                expect(error.message).toContain("check_geofence_radius_range");
                return;
            }
            throw error;
        }
    });

    test("EXPECTED TO FAIL: System accepts geofence radius = 1000 meters", async () => {
        const locationId = `test-location-radius-1000-${Date.now()}`;
        
        try {
            const [loc] = await db.insert(location).values({
                id: locationId,
                organizationId: testOrgId,
                name: "Test Location - Radius 1000",
                slug: `test-location-radius-1000-${Date.now()}`,
                timezone: "UTC",
                geofenceRadius: 1000, // INVALID: Above maximum of 500
                createdAt: new Date(),
                updatedAt: new Date(),
            }).returning();

            expect(loc.geofenceRadius).toBe(1000);
            await db.delete(location).where(eq(location.id, locationId));
            
            throw new Error(
                "BUG CONFIRMED: System accepted geofence radius = 1000 meters (above maximum of 500). " +
                "Counterexample: location with radius=1000 was successfully created."
            );
        } catch (error: any) {
            if (error.code === '23514') {
                expect(error.message).toContain("check_geofence_radius_range");
                return;
            }
            throw error;
        }
    });

    test("EXPECTED TO FAIL: System accepts geofence radius = 10000 meters", async () => {
        const locationId = `test-location-radius-10000-${Date.now()}`;
        
        try {
            const [loc] = await db.insert(location).values({
                id: locationId,
                organizationId: testOrgId,
                name: "Test Location - Radius 10000",
                slug: `test-location-radius-10000-${Date.now()}`,
                timezone: "UTC",
                geofenceRadius: 10000, // INVALID: Way above maximum
                createdAt: new Date(),
                updatedAt: new Date(),
            }).returning();

            expect(loc.geofenceRadius).toBe(10000);
            await db.delete(location).where(eq(location.id, locationId));
            
            throw new Error(
                "BUG CONFIRMED: System accepted geofence radius = 10000 meters (10km - way above maximum of 500m). " +
                "Counterexample: location with radius=10000 was successfully created."
            );
        } catch (error: any) {
            if (error.code === '23514') {
                expect(error.message).toContain("check_geofence_radius_range");
                return;
            }
            throw error;
        }
    });

    test("EXPECTED TO FAIL: System accepts UPDATE to invalid geofence radius", async () => {
        // First create a location with valid radius
        const locationId = `test-location-update-${Date.now()}`;
        const [loc] = await db.insert(location).values({
            id: locationId,
            organizationId: testOrgId,
            name: "Test Location - Update Test",
            slug: `test-location-update-${Date.now()}`,
            timezone: "UTC",
            geofenceRadius: 100, // Valid initially
            createdAt: new Date(),
            updatedAt: new Date(),
        }).returning();

        try {
            // Attempt to update to invalid radius
            const [updated] = await db.update(location)
                .set({ geofenceRadius: 0 }) // INVALID
                .where(eq(location.id, locationId))
                .returning();

            expect(updated.geofenceRadius).toBe(0);
            await db.delete(location).where(eq(location.id, locationId));
            
            throw new Error(
                "BUG CONFIRMED: System accepted UPDATE to geofence radius = 0 meters. " +
                "Counterexample: existing location was updated to invalid radius=0."
            );
        } catch (error: any) {
            if (error.code === '23514') {
                expect(error.message).toContain("check_geofence_radius_range");
                // Clean up
                await db.delete(location).where(eq(location.id, locationId));
                return;
            }
            throw error;
        }
    });
});

/**
 * COUNTEREXAMPLES DOCUMENTATION:
 * 
 * When this test runs on UNFIXED code, it will document counterexamples like:
 * - "location with radius=0 was successfully created"
 * - "location with radius=5 was successfully created (below minimum of 10)"
 * - "location with radius=1000 was successfully created (above maximum of 500)"
 * - "location with radius=10000 was successfully created (10km - way above maximum)"
 * - "existing location was updated to invalid radius=0"
 * 
 * These counterexamples prove that the bug exists and demonstrate the fault condition.
 * 
 * After implementing the fix (CHECK constraint), these tests should PASS because:
 * - The database will reject invalid radius values with error code 23514
 * - The tests catch the constraint violation and verify the error message
 * - No counterexamples will be generated (bug is fixed)
 */
