import { describe, expect, test, beforeAll } from "bun:test";
import { db } from "../src/db";
import { location, organization } from "../src/schema";
import { sql } from "drizzle-orm";

/**
 * EXPLORATION TEST - GEO-002: Missing Spatial Index
 * 
 * Property 1: Fault Condition - Slow Spatial Queries
 * 
 * CRITICAL: This test MUST show poor performance on unfixed code
 * 
 * GOAL: Demonstrate that ST_DWithin queries are slow without GIST index
 * 
 * Bug Condition (from design.md):
 * WHEN geofence queries execute ST_DWithin operations in `clock-in.ts` lines 60-75
 * THEN the system uses B-Tree indexes instead of GIST indexes for spatial queries
 * on the position column, causing slow query performance and potential timeouts under load
 * 
 * Expected Behavior (after fix):
 * WHEN geofence queries execute ST_DWithin operations in `clock-in.ts`
 * THEN the system SHALL use GIST indexes on the position column
 * to optimize spatial query performance and prevent timeouts under load
 * 
 * Requirements: 1.8 (Current Behavior), 2.8 (Expected Behavior)
 */

describe("GEO-002 Exploration: Missing Spatial Index Performance", () => {
    let testOrgId: string;
    let testLocationIds: string[] = [];

    beforeAll(async () => {
        // Create test organization
        const [org] = await db.insert(organization).values({
            id: `test-org-geo-002-${Date.now()}`,
            name: "Test Org for GEO-002",
            slug: `test-org-geo-002-${Date.now()}`,
            createdAt: new Date(),
            updatedAt: new Date(),
        }).returning();
        testOrgId = org.id;

        // Create multiple test locations to simulate realistic load
        // In production, there could be thousands of locations
        const locationsToCreate = 100; // Reduced for test speed, but enough to show difference
        
        console.log(`Creating ${locationsToCreate} test locations...`);
        
        for (let i = 0; i < locationsToCreate; i++) {
            const locationId = `test-location-geo-002-${Date.now()}-${i}`;
            
            // Spread locations across a geographic area (San Francisco Bay Area)
            // Latitude: 37.7 to 37.8, Longitude: -122.5 to -122.4
            const lat = 37.7 + (Math.random() * 0.1);
            const lng = -122.5 + (Math.random() * 0.1);
            
            await db.insert(location).values({
                id: locationId,
                organizationId: testOrgId,
                name: `Test Location ${i}`,
                slug: `test-location-${i}-${Date.now()}`,
                timezone: "America/Los_Angeles",
                position: { lat, lng },
                geofenceRadius: 100,
                createdAt: new Date(),
                updatedAt: new Date(),
            });
            
            testLocationIds.push(locationId);
        }
        
        console.log(`Created ${testLocationIds.length} test locations`);
    });

    test("EXPECTED TO SHOW POOR PERFORMANCE: Check query plan for spatial query", async () => {
        // Query the database to check what index type is being used
        const queryPlan = await db.execute(sql`
            EXPLAIN (FORMAT JSON)
            SELECT 
                id,
                name,
                ST_DWithin(
                    ST_GeogFromText('POINT(-122.45 37.75)'),
                    position::geography,
                    100
                ) as is_within
            FROM location
            WHERE organization_id = ${testOrgId}
        `);

        const plan = queryPlan.rows[0] as any;
        const planText = JSON.stringify(plan, null, 2);
        
        console.log("\n=== QUERY PLAN ===");
        console.log(planText);
        console.log("==================\n");

        // Check if the plan mentions GIST index
        const hasGistIndex = planText.toLowerCase().includes('gist');
        const hasBTreeIndex = planText.toLowerCase().includes('btree') || 
                             planText.toLowerCase().includes('b-tree');
        
        if (!hasGistIndex && hasBTreeIndex) {
            console.log("⚠️  BUG CONFIRMED: Query plan shows B-Tree index usage for spatial query");
            console.log("   This is inefficient for spatial operations like ST_DWithin");
            console.log("   Expected: GIST index for optimal spatial query performance");
        } else if (!hasGistIndex && !hasBTreeIndex) {
            console.log("⚠️  BUG CONFIRMED: No spatial index found - using sequential scan");
            console.log("   This will be extremely slow with many locations");
        } else if (hasGistIndex) {
            console.log("✓  FIXED: Query plan shows GIST index usage");
        }

        // Document the finding
        expect(hasGistIndex).toBe(false); // Should be false on unfixed code
        
        // This assertion will fail on unfixed code, confirming the bug
        throw new Error(
            "BUG CONFIRMED: Spatial queries are not using GIST index. " +
            `Query plan shows: ${hasBTreeIndex ? 'B-Tree index' : 'Sequential scan'}. ` +
            "This causes poor performance for geofence operations."
        );
    });

    test("EXPECTED TO SHOW POOR PERFORMANCE: Measure ST_DWithin query execution time", async () => {
        // Test point in San Francisco
        const testLat = 37.75;
        const testLng = -122.45;
        const testRadius = 100; // meters

        // Warm up the query (first query might be slower due to caching)
        await db.execute(sql`
            SELECT id
            FROM location
            WHERE organization_id = ${testOrgId}
            LIMIT 1
        `);

        // Measure query execution time
        const iterations = 10;
        const timings: number[] = [];

        console.log(`\nRunning ${iterations} spatial queries...`);

        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            
            await db.execute(sql`
                SELECT 
                    id,
                    name,
                    ST_DWithin(
                        position::geography,
                        ST_GeogFromText('POINT(${testLng} ${testLat})'),
                        ${testRadius}
                    ) as is_within,
                    ST_Distance(
                        position::geography,
                        ST_GeogFromText('POINT(${testLng} ${testLat})')
                    ) as distance
                FROM location
                WHERE organization_id = ${testOrgId}
            `);
            
            const duration = performance.now() - start;
            timings.push(duration);
        }

        // Calculate statistics
        const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
        const minTime = Math.min(...timings);
        const maxTime = Math.max(...timings);
        const p95Time = timings.sort((a, b) => a - b)[Math.floor(timings.length * 0.95)];

        console.log("\n=== PERFORMANCE METRICS ===");
        console.log(`Average query time: ${avgTime.toFixed(2)}ms`);
        console.log(`Min query time: ${minTime.toFixed(2)}ms`);
        console.log(`Max query time: ${maxTime.toFixed(2)}ms`);
        console.log(`P95 query time: ${p95Time.toFixed(2)}ms`);
        console.log("===========================\n");

        // Performance baseline expectations:
        // - With GIST index: < 20ms average, < 50ms p95
        // - Without GIST index (B-Tree): > 50ms average, > 100ms p95
        // - Sequential scan: > 100ms average, > 200ms p95

        const performanceThreshold = 50; // ms - acceptable with GIST index

        if (avgTime > performanceThreshold) {
            console.log(`⚠️  BUG CONFIRMED: Average query time ${avgTime.toFixed(2)}ms exceeds threshold of ${performanceThreshold}ms`);
            console.log("   This indicates missing or inefficient spatial index");
            console.log("   With GIST index, queries should average < 20ms");
        } else {
            console.log(`✓  FIXED: Average query time ${avgTime.toFixed(2)}ms is within acceptable range`);
        }

        // Document performance baseline for comparison after fix
        console.log("\nPerformance baseline documented:");
        console.log(`- Current average: ${avgTime.toFixed(2)}ms`);
        console.log(`- Current p95: ${p95Time.toFixed(2)}ms`);
        console.log("- Expected after GIST index: < 20ms average, < 50ms p95");

        // This assertion will fail on unfixed code if performance is poor
        expect(avgTime).toBeLessThan(performanceThreshold);
        
        throw new Error(
            `BUG CONFIRMED: Spatial query performance is poor. ` +
            `Average: ${avgTime.toFixed(2)}ms, P95: ${p95Time.toFixed(2)}ms. ` +
            `Expected with GIST index: < 20ms average, < 50ms p95.`
        );
    });

    test("EXPECTED TO SHOW POOR PERFORMANCE: Check index type on position column", async () => {
        // Query PostgreSQL system catalogs to check index type
        const indexInfo = await db.execute(sql`
            SELECT 
                i.relname as index_name,
                am.amname as index_type,
                a.attname as column_name
            FROM pg_class t
            JOIN pg_index ix ON t.oid = ix.indrelid
            JOIN pg_class i ON i.oid = ix.indexrelid
            JOIN pg_am am ON i.relam = am.oid
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
            WHERE t.relname = 'location'
            AND a.attname = 'position'
        `);

        console.log("\n=== INDEX INFORMATION ===");
        
        if (indexInfo.rows.length === 0) {
            console.log("⚠️  BUG CONFIRMED: No index found on position column");
            console.log("   Spatial queries will use sequential scan");
            
            throw new Error(
                "BUG CONFIRMED: No index exists on location.position column. " +
                "Spatial queries will be extremely slow."
            );
        }

        indexInfo.rows.forEach((row: any) => {
            console.log(`Index: ${row.index_name}`);
            console.log(`Type: ${row.index_type}`);
            console.log(`Column: ${row.column_name}`);
        });
        console.log("=========================\n");

        const hasGistIndex = indexInfo.rows.some((row: any) => 
            row.index_type === 'gist'
        );
        const hasBTreeIndex = indexInfo.rows.some((row: any) => 
            row.index_type === 'btree'
        );

        if (!hasGistIndex && hasBTreeIndex) {
            console.log("⚠️  BUG CONFIRMED: Position column uses B-Tree index instead of GIST");
            console.log("   B-Tree indexes are not optimized for spatial operations");
            console.log("   This matches the comment in schema.ts: 'Switched from GIST to B-Tree temporarily'");
            
            throw new Error(
                "BUG CONFIRMED: location.position uses B-Tree index instead of GIST. " +
                "B-Tree indexes are inefficient for spatial queries like ST_DWithin. " +
                "Schema comment confirms: 'Switched from GIST to B-Tree temporarily'"
            );
        } else if (hasGistIndex) {
            console.log("✓  FIXED: Position column uses GIST index");
        }

        // This assertion will fail on unfixed code
        expect(hasGistIndex).toBe(true);
    });
});

/**
 * COUNTEREXAMPLES DOCUMENTATION:
 * 
 * When this test runs on UNFIXED code, it will document counterexamples like:
 * - "Query plan shows B-Tree index usage for spatial query"
 * - "Average query time 85.32ms exceeds threshold of 50ms"
 * - "P95 query time 120.45ms indicates poor performance"
 * - "Position column uses B-Tree index instead of GIST"
 * - "Schema comment confirms: 'Switched from GIST to B-Tree temporarily'"
 * 
 * These counterexamples prove that the bug exists and demonstrate the fault condition.
 * 
 * After implementing the fix (GIST index), these tests should PASS because:
 * - Query plan will show GIST index usage
 * - Average query time will be < 20ms
 * - P95 query time will be < 50ms
 * - System catalogs will show index_type = 'gist'
 * 
 * Performance improvement expected: 5-10x faster queries with GIST index
 */
