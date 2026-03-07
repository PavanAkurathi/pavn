#!/usr/bin/env bun
/**
 * Script: Fix Invalid Geofence Radius Data
 * Task: 3.2 Fix existing invalid geofence radius data
 * 
 * This script identifies and fixes locations with invalid geofence radius values
 * before the CHECK constraint is added in migration 0010.
 * 
 * Invalid values:
 * - NULL → 100 (default)
 * - < 10 → 10 (minimum)
 * - > 500 → 500 (maximum)
 * 
 * Usage:
 *   bun run packages/database/scripts/fix-invalid-geofence-radius.ts
 * 
 * Or with explicit env file:
 *   bun --env-file=.env packages/database/scripts/fix-invalid-geofence-radius.ts
 */

import { db } from "../src/db";
import { location } from "../src/schema";
import { or, lt, gt, isNull, sql } from "drizzle-orm";

async function fixInvalidGeofenceRadius() {
    console.log("🔍 Checking for locations with invalid geofence radius...\n");

    // Query for invalid radius values
    const invalidLocations = await db.select({
        id: location.id,
        name: location.name,
        organizationId: location.organizationId,
        geofenceRadius: location.geofenceRadius,
    })
    .from(location)
    .where(
        or(
            lt(location.geofenceRadius, 10),
            gt(location.geofenceRadius, 500),
            isNull(location.geofenceRadius)
        )
    );

    if (invalidLocations.length === 0) {
        console.log("✅ No invalid geofence radius values found. All locations are valid!");
        return;
    }

    console.log(`⚠️  Found ${invalidLocations.length} locations with invalid geofence radius:\n`);

    // Group by issue type
    const nullValues = invalidLocations.filter(loc => loc.geofenceRadius === null);
    const tooSmall = invalidLocations.filter(loc => loc.geofenceRadius !== null && loc.geofenceRadius < 10);
    const tooLarge = invalidLocations.filter(loc => loc.geofenceRadius !== null && loc.geofenceRadius > 500);

    if (nullValues.length > 0) {
        console.log(`  📍 ${nullValues.length} locations with NULL radius (will set to 100m default)`);
    }
    if (tooSmall.length > 0) {
        console.log(`  📍 ${tooSmall.length} locations with radius < 10m (will set to 10m minimum)`);
        tooSmall.forEach(loc => {
            console.log(`     - ${loc.name} (${loc.id}): ${loc.geofenceRadius}m → 10m`);
        });
    }
    if (tooLarge.length > 0) {
        console.log(`  📍 ${tooLarge.length} locations with radius > 500m (will set to 500m maximum)`);
        tooLarge.forEach(loc => {
            console.log(`     - ${loc.name} (${loc.id}): ${loc.geofenceRadius}m → 500m`);
        });
    }

    console.log("\n🔧 Fixing invalid values...\n");

    // Fix invalid values using CASE statement
    const result = await db.execute(sql`
        UPDATE location 
        SET geofence_radius = CASE
            WHEN geofence_radius IS NULL THEN 100
            WHEN geofence_radius < 10 THEN 10
            WHEN geofence_radius > 500 THEN 500
            ELSE geofence_radius
        END
        WHERE geofence_radius < 10 OR geofence_radius > 500 OR geofence_radius IS NULL
    `);

    console.log(`✅ Fixed ${invalidLocations.length} locations with invalid geofence radius\n`);

    // Verify the fix
    const remainingInvalid = await db.select({
        id: location.id,
        geofenceRadius: location.geofenceRadius,
    })
    .from(location)
    .where(
        or(
            lt(location.geofenceRadius, 10),
            gt(location.geofenceRadius, 500),
            isNull(location.geofenceRadius)
        )
    );

    if (remainingInvalid.length === 0) {
        console.log("✅ Verification passed: All locations now have valid geofence radius (10-500m)");
    } else {
        console.error(`❌ Verification failed: ${remainingInvalid.length} locations still have invalid radius`);
        console.error("   This should not happen. Please investigate.");
        process.exit(1);
    }

    // Show summary statistics
    console.log("\n📊 Summary:");
    const stats = await db.execute(sql`
        SELECT 
            COUNT(*) as total_locations,
            MIN(geofence_radius) as min_radius,
            MAX(geofence_radius) as max_radius,
            AVG(geofence_radius)::numeric(10,2) as avg_radius,
            COUNT(CASE WHEN geofence_radius = 10 THEN 1 END) as count_at_min,
            COUNT(CASE WHEN geofence_radius = 100 THEN 1 END) as count_at_default,
            COUNT(CASE WHEN geofence_radius = 500 THEN 1 END) as count_at_max
        FROM location
    `);

    const summary = stats.rows[0] as any;
    console.log(`  Total locations: ${summary.total_locations}`);
    console.log(`  Radius range: ${summary.min_radius}m - ${summary.max_radius}m`);
    console.log(`  Average radius: ${summary.avg_radius}m`);
    console.log(`  At minimum (10m): ${summary.count_at_min}`);
    console.log(`  At default (100m): ${summary.count_at_default}`);
    console.log(`  At maximum (500m): ${summary.count_at_max}`);

    console.log("\n✅ Data cleanup complete! Ready for migration 0010 (CHECK constraint).");
}

// Run the script
fixInvalidGeofenceRadius()
    .then(() => {
        console.log("\n✅ Script completed successfully");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Script failed:", error);
        process.exit(1);
    });
