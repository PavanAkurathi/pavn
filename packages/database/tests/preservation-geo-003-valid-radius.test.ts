import { describe, expect, test, beforeAll } from "bun:test";
import { db } from "../src/db";
import { location, organization } from "../src/schema";
import { eq } from "drizzle-orm";

/**
 * PRESERVATION TEST - GEO-003: Valid Geofence Radius Operations
 * 
 * Property 2: Preservation - Valid Radius Operations
 * 
 * IMPORTANT: Follow observation-first methodology
 * 
 * GOAL: Verify that valid geofence radius values (10-500 meters) work correctly
 * and continue to work after the CHECK constraint is added
 * 
 * Expected Behavior (must be preserved):
 * WHEN an admin sets a valid geofence radius (e.g., 100 meters) within the acceptable range
 * THEN the system SHALL CONTINUE TO store and use that radius for all geofence
 * validation operations without errors
 * 
 * Requirements: 3.9 (Unchanged Behavior - Regression Prevention)
 */

describe("GEO-003 Preservation: Valid Geofence Radius Operations", () => {
    let testOrgId: string;

    beforeAll(async () => {
        // Create test organization
        const [org] = await db.insert(organization).values({
            id: `test-org-preservation-${Date.now()}`,
            name: "Test Org for Preservation",
            slug: `test-org-preservation-${Date.now()}`,
            createdAt: new Date(),
            updatedAt: new Date(),
        }).returning();
        testOrgId = org.id;
    });

    test("MUST PASS: System accepts geofence radius = 10 meters (minimum)", async () => {
        const locationId = `test-location-radius-10-${Date.now()}`;
        
        const [loc] = await db.insert(location).values({
            id: locationId,
            organizationId: testOrgId,
            name: "Test Location - Radius 10",
            slug: `test-location-radius-10-${Date.now()}`,
            timezone: "UTC",
            geofenceRadius: 10, // VALID: Minimum acceptable value
            createdAt: new Date(),
            updatedAt: new Date(),
        }).returning();

        // Verify the value was stored correctly
        expect(loc.geofenceRadius).toBe(10);
        
        // Verify we can query it back
        const [queried] = await db.select()
            .from(location)
            .where(eq(location.id, locationId));
        
        expect(queried.geofenceRadius).toBe(10);
        
        // Clean up
        await db.delete(location).where(eq(location.id, locationId));
        
        console.log("✓ Preserved: radius = 10 meters (minimum) works correctly");
    });

    test("MUST PASS: System accepts geofence radius = 50 meters", async () => {
        const locationId = `test-location-radius-50-${Date.now()}`;
        
        const [loc] = await db.insert(location).values({
            id: locationId,
            organizationId: testOrgId,
            name: "Test Location - Radius 50",
            slug: `test-location-radius-50-${Date.now()}`,
            timezone: "UTC",
            geofenceRadius: 50, // VALID: Common value
            createdAt: new Date(),
            updatedAt: new Date(),
        }).returning();

        expect(loc.geofenceRadius).toBe(50);
        
        const [queried] = await db.select()
            .from(location)
            .where(eq(location.id, locationId));
        
        expect(queried.geofenceRadius).toBe(50);
        
        await db.delete(location).where(eq(location.id, locationId));
        
        console.log("✓ Preserved: radius = 50 meters works correctly");
    });

    test("MUST PASS: System accepts geofence radius = 100 meters (default)", async () => {
        const locationId = `test-location-radius-100-${Date.now()}`;
        
        const [loc] = await db.insert(location).values({
            id: locationId,
            organizationId: testOrgId,
            name: "Test Location - Radius 100",
            slug: `test-location-radius-100-${Date.now()}`,
            timezone: "UTC",
            geofenceRadius: 100, // VALID: Default value
            createdAt: new Date(),
            updatedAt: new Date(),
        }).returning();

        expect(loc.geofenceRadius).toBe(100);
        
        const [queried] = await db.select()
            .from(location)
            .where(eq(location.id, locationId));
        
        expect(queried.geofenceRadius).toBe(100);
        
        await db.delete(location).where(eq(location.id, locationId));
        
        console.log("✓ Preserved: radius = 100 meters (default) works correctly");
    });

    test("MUST PASS: System accepts geofence radius = 150 meters", async () => {
        const locationId = `test-location-radius-150-${Date.now()}`;
        
        const [loc] = await db.insert(location).values({
            id: locationId,
            organizationId: testOrgId,
            name: "Test Location - Radius 150",
            slug: `test-location-radius-150-${Date.now()}`,
            timezone: "UTC",
            geofenceRadius: 150, // VALID: Common value for larger venues
            createdAt: new Date(),
            updatedAt: new Date(),
        }).returning();

        expect(loc.geofenceRadius).toBe(150);
        
        const [queried] = await db.select()
            .from(location)
            .where(eq(location.id, locationId));
        
        expect(queried.geofenceRadius).toBe(150);
        
        await db.delete(location).where(eq(location.id, locationId));
        
        console.log("✓ Preserved: radius = 150 meters works correctly");
    });

    test("MUST PASS: System accepts geofence radius = 500 meters (maximum)", async () => {
        const locationId = `test-location-radius-500-${Date.now()}`;
        
        const [loc] = await db.insert(location).values({
            id: locationId,
            organizationId: testOrgId,
            name: "Test Location - Radius 500",
            slug: `test-location-radius-500-${Date.now()}`,
            timezone: "UTC",
            geofenceRadius: 500, // VALID: Maximum acceptable value
            createdAt: new Date(),
            updatedAt: new Date(),
        }).returning();

        expect(loc.geofenceRadius).toBe(500);
        
        const [queried] = await db.select()
            .from(location)
            .where(eq(location.id, locationId));
        
        expect(queried.geofenceRadius).toBe(500);
        
        await db.delete(location).where(eq(location.id, locationId));
        
        console.log("✓ Preserved: radius = 500 meters (maximum) works correctly");
    });

    test("MUST PASS: System accepts UPDATE to valid geofence radius", async () => {
        // Create location with one valid radius
        const locationId = `test-location-update-valid-${Date.now()}`;
        const [loc] = await db.insert(location).values({
            id: locationId,
            organizationId: testOrgId,
            name: "Test Location - Update Valid",
            slug: `test-location-update-valid-${Date.now()}`,
            timezone: "UTC",
            geofenceRadius: 100, // Start with 100
            createdAt: new Date(),
            updatedAt: new Date(),
        }).returning();

        expect(loc.geofenceRadius).toBe(100);

        // Update to another valid radius
        const [updated] = await db.update(location)
            .set({ geofenceRadius: 200 }) // VALID: Update to 200
            .where(eq(location.id, locationId))
            .returning();

        expect(updated.geofenceRadius).toBe(200);
        
        // Verify the update persisted
        const [queried] = await db.select()
            .from(location)
            .where(eq(location.id, locationId));
        
        expect(queried.geofenceRadius).toBe(200);
        
        // Clean up
        await db.delete(location).where(eq(location.id, locationId));
        
        console.log("✓ Preserved: UPDATE to valid radius works correctly");
    });

    test("MUST PASS: System uses default radius when not specified", async () => {
        const locationId = `test-location-default-${Date.now()}`;
        
        // Insert without specifying geofenceRadius - should use default (100)
        const [loc] = await db.insert(location).values({
            id: locationId,
            organizationId: testOrgId,
            name: "Test Location - Default Radius",
            slug: `test-location-default-${Date.now()}`,
            timezone: "UTC",
            // geofenceRadius not specified - should default to 100
            createdAt: new Date(),
            updatedAt: new Date(),
        }).returning();

        // Verify default was applied
        expect(loc.geofenceRadius).toBe(100);
        
        const [queried] = await db.select()
            .from(location)
            .where(eq(location.id, locationId));
        
        expect(queried.geofenceRadius).toBe(100);
        
        await db.delete(location).where(eq(location.id, locationId));
        
        console.log("✓ Preserved: default radius (100 meters) is applied correctly");
    });

    test("MUST PASS: System accepts all valid radius values in range", async () => {
        // Test a range of valid values
        const validRadii = [10, 25, 50, 75, 100, 150, 200, 300, 400, 500];
        const locationIds: string[] = [];

        for (const radius of validRadii) {
            const locationId = `test-location-range-${radius}-${Date.now()}`;
            
            const [loc] = await db.insert(location).values({
                id: locationId,
                organizationId: testOrgId,
                name: `Test Location - Radius ${radius}`,
                slug: `test-location-range-${radius}-${Date.now()}`,
                timezone: "UTC",
                geofenceRadius: radius,
                createdAt: new Date(),
                updatedAt: new Date(),
            }).returning();

            expect(loc.geofenceRadius).toBe(radius);
            locationIds.push(locationId);
        }

        // Clean up all test locations
        for (const locationId of locationIds) {
            await db.delete(location).where(eq(location.id, locationId));
        }
        
        console.log(`✓ Preserved: all ${validRadii.length} valid radius values work correctly`);
    });
});

/**
 * PRESERVATION VERIFICATION:
 * 
 * This test suite MUST PASS on both unfixed and fixed code.
 * 
 * On UNFIXED code (before CHECK constraint):
 * - All valid radius values (10-500) are accepted
 * - Default value (100) is applied when not specified
 * - UPDATE operations work correctly
 * - All tests PASS
 * 
 * On FIXED code (after CHECK constraint):
 * - All valid radius values (10-500) are still accepted
 * - Default value (100) is still applied when not specified
 * - UPDATE operations still work correctly
 * - All tests STILL PASS (no regressions)
 * 
 * If any test FAILS after the fix, it indicates a regression where
 * the CHECK constraint is too restrictive or incorrectly implemented.
 * 
 * The CHECK constraint should be:
 * CHECK (geofence_radius >= 10 AND geofence_radius <= 500)
 * 
 * This allows all values in the range [10, 500] inclusive.
 */
