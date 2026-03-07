import { describe, expect, test, beforeAll } from "bun:test";
import { db } from "../src/db";
import { location, organization } from "../src/schema";
import { sql } from "drizzle-orm";

/**
 * PRESERVATION TEST - GEO-002: Spatial Query Correctness
 * 
 * Property 2: Preservation - Correct Distance Calculations
 * 
 * IMPORTANT: Follow observation-first methodology
 * 
 * GOAL: Verify that spatial queries return correct results regardless of index type
 * 
 * Expected Behavior (must be preserved):
 * WHEN geofence queries execute with proper spatial indexes
 * THEN the system SHALL CONTINUE TO return correct distance calculations
 * and isWithin boolean results, maintaining the current geofence validation logic
 * 
 * Requirements: 3.8 (Unchanged Behavior - Regression Prevention)
 */

describe("GEO-002 Preservation: Spatial Query Correctness", () => {
    let testOrgId: string;
    let testLocationId: string;

    // Known test location: San Francisco City Hall
    const testLocation = {
        name: "San Francisco City Hall",
        lat: 37.7793,
        lng: -122.4193,
        radius: 100, // 100 meters
    };

    beforeAll(async () => {
        // Create test organization
        const [org] = await db.insert(organization).values({
            id: `test-org-spatial-${Date.now()}`,
            name: "Test Org for Spatial Correctness",
            slug: `test-org-spatial-${Date.now()}`,
            createdAt: new Date(),
            updatedAt: new Date(),
        }).returning();
        testOrgId = org.id;

        // Create test location
        testLocationId = `test-location-spatial-${Date.now()}`;
        await db.insert(location).values({
            id: testLocationId,
            organizationId: testOrgId,
            name: testLocation.name,
            slug: `test-location-spatial-${Date.now()}`,
            timezone: "America/Los_Angeles",
            position: { lat: testLocation.lat, lng: testLocation.lng },
            geofenceRadius: testLocation.radius,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    });

    test("MUST PASS: ST_DWithin correctly identifies point inside geofence", async () => {
        // Test point 50 meters away (inside 100m radius)
        // Using approximate offset: ~0.00045 degrees latitude ≈ 50 meters
        const testLat = testLocation.lat + 0.00045;
        const testLng = testLocation.lng;

        const result = await db.execute(sql`
            SELECT 
                ST_DWithin(
                    position::geography,
                    ST_GeogFromText('POINT(${testLng} ${testLat})'),
                    ${testLocation.radius}
                ) as is_within,
                ST_Distance(
                    position::geography,
                    ST_GeogFromText('POINT(${testLng} ${testLat})')
                ) as distance
            FROM location
            WHERE id = ${testLocationId}
        `);

        const row = result.rows[0] as any;
        
        // Point should be within geofence
        expect(row.is_within).toBe(true);
        
        // Distance should be approximately 50 meters (allow 10m tolerance)
        const distance = parseFloat(row.distance);
        expect(distance).toBeGreaterThan(40);
        expect(distance).toBeLessThan(60);
        
        console.log(`✓ Preserved: ST_DWithin correctly identifies point inside geofence (${distance.toFixed(2)}m)`);
    });

    test("MUST PASS: ST_DWithin correctly identifies point outside geofence", async () => {
        // Test point 150 meters away (outside 100m radius)
        // Using approximate offset: ~0.00135 degrees latitude ≈ 150 meters
        const testLat = testLocation.lat + 0.00135;
        const testLng = testLocation.lng;

        const result = await db.execute(sql`
            SELECT 
                ST_DWithin(
                    position::geography,
                    ST_GeogFromText('POINT(${testLng} ${testLat})'),
                    ${testLocation.radius}
                ) as is_within,
                ST_Distance(
                    position::geography,
                    ST_GeogFromText('POINT(${testLng} ${testLat})')
                ) as distance
            FROM location
            WHERE id = ${testLocationId}
        `);

        const row = result.rows[0] as any;
        
        // Point should be outside geofence
        expect(row.is_within).toBe(false);
        
        // Distance should be approximately 150 meters (allow 20m tolerance)
        const distance = parseFloat(row.distance);
        expect(distance).toBeGreaterThan(130);
        expect(distance).toBeLessThan(170);
        
        console.log(`✓ Preserved: ST_DWithin correctly identifies point outside geofence (${distance.toFixed(2)}m)`);
    });

    test("MUST PASS: ST_DWithin correctly identifies point at geofence boundary", async () => {
        // Test point exactly 100 meters away (at boundary)
        // Using approximate offset: ~0.0009 degrees latitude ≈ 100 meters
        const testLat = testLocation.lat + 0.0009;
        const testLng = testLocation.lng;

        const result = await db.execute(sql`
            SELECT 
                ST_DWithin(
                    position::geography,
                    ST_GeogFromText('POINT(${testLng} ${testLat})'),
                    ${testLocation.radius}
                ) as is_within,
                ST_Distance(
                    position::geography,
                    ST_GeogFromText('POINT(${testLng} ${testLat})')
                ) as distance
            FROM location
            WHERE id = ${testLocationId}
        `);

        const row = result.rows[0] as any;
        const distance = parseFloat(row.distance);
        
        // Point at boundary should be within geofence (ST_DWithin is inclusive)
        expect(row.is_within).toBe(true);
        
        // Distance should be approximately 100 meters (allow 15m tolerance)
        expect(distance).toBeGreaterThan(85);
        expect(distance).toBeLessThan(115);
        
        console.log(`✓ Preserved: ST_DWithin correctly handles boundary case (${distance.toFixed(2)}m)`);
    });

    test("MUST PASS: ST_Distance returns accurate distance calculations", async () => {
        // Test multiple known distances
        const testCases = [
            { offsetLat: 0.00045, offsetLng: 0, expectedDistance: 50, tolerance: 10 },
            { offsetLat: 0.0009, offsetLng: 0, expectedDistance: 100, tolerance: 15 },
            { offsetLat: 0.00135, offsetLng: 0, expectedDistance: 150, tolerance: 20 },
            { offsetLat: 0, offsetLng: 0.00045, expectedDistance: 50, tolerance: 10 },
        ];

        for (const testCase of testCases) {
            const testLat = testLocation.lat + testCase.offsetLat;
            const testLng = testLocation.lng + testCase.offsetLng;

            const result = await db.execute(sql`
                SELECT 
                    ST_Distance(
                        position::geography,
                        ST_GeogFromText('POINT(${testLng} ${testLat})')
                    ) as distance
                FROM location
                WHERE id = ${testLocationId}
            `);

            const row = result.rows[0] as any;
            const distance = parseFloat(row.distance);
            
            // Verify distance is within expected range
            expect(distance).toBeGreaterThan(testCase.expectedDistance - testCase.tolerance);
            expect(distance).toBeLessThan(testCase.expectedDistance + testCase.tolerance);
        }
        
        console.log(`✓ Preserved: ST_Distance returns accurate calculations for ${testCases.length} test cases`);
    });

    test("MUST PASS: Spatial queries handle same location (distance = 0)", async () => {
        // Test point at exact same location
        const testLat = testLocation.lat;
        const testLng = testLocation.lng;

        const result = await db.execute(sql`
            SELECT 
                ST_DWithin(
                    position::geography,
                    ST_GeogFromText('POINT(${testLng} ${testLat})'),
                    ${testLocation.radius}
                ) as is_within,
                ST_Distance(
                    position::geography,
                    ST_GeogFromText('POINT(${testLng} ${testLat})')
                ) as distance
            FROM location
            WHERE id = ${testLocationId}
        `);

        const row = result.rows[0] as any;
        const distance = parseFloat(row.distance);
        
        // Same location should be within geofence
        expect(row.is_within).toBe(true);
        
        // Distance should be 0 (or very close to 0)
        expect(distance).toBeLessThan(1);
        
        console.log(`✓ Preserved: Spatial queries correctly handle same location (distance = ${distance.toFixed(2)}m)`);
    });

    test("MUST PASS: Spatial queries work with different geofence radii", async () => {
        // Test with various radii
        const radii = [50, 100, 200, 500];
        const testLat = testLocation.lat + 0.00135; // ~150 meters away
        const testLng = testLocation.lng;

        for (const radius of radii) {
            const result = await db.execute(sql`
                SELECT 
                    ST_DWithin(
                        position::geography,
                        ST_GeogFromText('POINT(${testLng} ${testLat})'),
                        ${radius}
                    ) as is_within
                FROM location
                WHERE id = ${testLocationId}
            `);

            const row = result.rows[0] as any;
            
            // Point at ~150m should be:
            // - Outside 50m and 100m radius (false)
            // - Inside 200m and 500m radius (true)
            if (radius < 150) {
                expect(row.is_within).toBe(false);
            } else {
                expect(row.is_within).toBe(true);
            }
        }
        
        console.log(`✓ Preserved: Spatial queries work correctly with ${radii.length} different radii`);
    });

    test("MUST PASS: Spatial queries handle longitude/latitude correctly", async () => {
        // Test that longitude and latitude are not swapped
        // Move point east (positive longitude) and verify distance
        const testLat = testLocation.lat;
        const testLng = testLocation.lng + 0.00045; // ~50 meters east

        const result = await db.execute(sql`
            SELECT 
                ST_Distance(
                    position::geography,
                    ST_GeogFromText('POINT(${testLng} ${testLat})')
                ) as distance
            FROM location
            WHERE id = ${testLocationId}
        `);

        const row = result.rows[0] as any;
        const distance = parseFloat(row.distance);
        
        // Distance should be approximately 50 meters (not 0 or very large)
        expect(distance).toBeGreaterThan(40);
        expect(distance).toBeLessThan(60);
        
        console.log(`✓ Preserved: Spatial queries handle longitude/latitude correctly (${distance.toFixed(2)}m)`);
    });

    test("MUST PASS: Multiple spatial queries return consistent results", async () => {
        // Run the same query multiple times and verify consistency
        const testLat = testLocation.lat + 0.00045;
        const testLng = testLocation.lng;
        const iterations = 5;
        const distances: number[] = [];

        for (let i = 0; i < iterations; i++) {
            const result = await db.execute(sql`
                SELECT 
                    ST_Distance(
                        position::geography,
                        ST_GeogFromText('POINT(${testLng} ${testLat})')
                    ) as distance
                FROM location
                WHERE id = ${testLocationId}
            `);

            const row = result.rows[0] as any;
            distances.push(parseFloat(row.distance));
        }

        // All distances should be identical (or within floating point precision)
        const firstDistance = distances[0];
        for (const distance of distances) {
            expect(Math.abs(distance - firstDistance)).toBeLessThan(0.01);
        }
        
        console.log(`✓ Preserved: ${iterations} spatial queries return consistent results (${firstDistance.toFixed(2)}m)`);
    });
});

/**
 * PRESERVATION VERIFICATION:
 * 
 * This test suite MUST PASS on both unfixed and fixed code.
 * 
 * On UNFIXED code (with B-Tree index):
 * - Spatial queries return correct results (but may be slow)
 * - ST_DWithin correctly identifies inside/outside geofence
 * - ST_Distance returns accurate distance calculations
 * - All tests PASS
 * 
 * On FIXED code (with GIST index):
 * - Spatial queries return the SAME correct results (but faster)
 * - ST_DWithin still correctly identifies inside/outside geofence
 * - ST_Distance still returns accurate distance calculations
 * - All tests STILL PASS (no regressions)
 * 
 * The GIST index should only improve PERFORMANCE, not change CORRECTNESS.
 * 
 * If any test FAILS after the fix, it indicates:
 * - GIST index was created incorrectly
 * - Geography type conversion introduced errors
 * - Spatial query logic was accidentally modified
 * 
 * Expected behavior after GIST index:
 * - All tests pass with identical results
 * - Query execution time is 5-10x faster
 * - No changes to distance calculations or isWithin logic
 */
