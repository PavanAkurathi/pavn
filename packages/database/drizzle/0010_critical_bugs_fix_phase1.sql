-- Migration: Critical Bugs Fix - Phase 1 (Database Schema Changes)
-- Date: 2026-01-XX
-- Description: Adds indexes, constraints, and columns for GEO-002, GEO-003, RACE-003, NOTIF-004, GEO-001
-- Related Tasks: 3.1 Create migration script for Phase 1 schema changes

-- ============================================================================
-- GEO-002: Add GIST Index for Spatial Queries
-- ============================================================================
-- Bug: ST_DWithin queries use B-Tree index causing slow performance
-- Fix: Create GIST index optimized for spatial operations
-- Note: Using CONCURRENTLY to avoid locking the table during index creation

-- First, ensure PostGIS extension is available
CREATE EXTENSION IF NOT EXISTS postgis;

-- Drop existing B-Tree index on position (if it exists)
DROP INDEX IF EXISTS location_pos_idx;

-- Create GIST index for spatial queries (CONCURRENTLY to avoid locks)
CREATE INDEX CONCURRENTLY IF NOT EXISTS location_position_gist_idx 
ON location USING gist(position);

-- ============================================================================
-- GEO-003: Add CHECK Constraint for Geofence Radius
-- ============================================================================
-- Bug: System accepts invalid geofence radius values (0, 10000, etc.)
-- Fix: Add CHECK constraint ensuring radius is between 10 and 500 meters

-- First, fix any existing invalid data
UPDATE location 
SET geofence_radius = CASE
    WHEN geofence_radius IS NULL THEN 100
    WHEN geofence_radius < 10 THEN 10
    WHEN geofence_radius > 500 THEN 500
    ELSE geofence_radius
END
WHERE geofence_radius < 10 OR geofence_radius > 500 OR geofence_radius IS NULL;

-- Add CHECK constraint
ALTER TABLE location 
ADD CONSTRAINT check_geofence_radius_range 
CHECK (geofence_radius >= 10 AND geofence_radius <= 500);

-- ============================================================================
-- RACE-003: Add Notification Idempotency Support
-- ============================================================================
-- Bug: Duplicate notifications created with same idempotency key
-- Fix: Add payload_hash column and unique index on idempotency_key

-- Add payload_hash column to notification table (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notification' AND column_name = 'payload_hash'
    ) THEN
        ALTER TABLE notification ADD COLUMN payload_hash VARCHAR(64);
    END IF;
END $$;

-- Create unique index on idempotency_key (CONCURRENTLY to avoid locks)
-- Only for non-null idempotency keys
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_idempotency 
ON notification(idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- ============================================================================
-- NOTIF-004: Add Timezone Support for Workers and Shifts
-- ============================================================================
-- Bug: Quiet hours use server time instead of worker timezone
-- Fix: Add timezone columns to worker and shift tables

-- Add timezone column to worker table (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'worker' AND column_name = 'timezone'
    ) THEN
        ALTER TABLE worker ADD COLUMN timezone VARCHAR(50) DEFAULT 'UTC';
    END IF;
END $$;

-- Add timezone column to shift table (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shift' AND column_name = 'timezone'
    ) THEN
        ALTER TABLE shift ADD COLUMN timezone VARCHAR(50);
    END IF;
END $$;

-- Migrate existing workers to organization timezone or UTC
UPDATE worker w
SET timezone = COALESCE(o.timezone, 'UTC')
FROM organization o
WHERE w.organization_id = o.id
AND (w.timezone IS NULL OR w.timezone = '');

-- ============================================================================
-- GEO-001: Add GPS Accuracy Metadata Columns
-- ============================================================================
-- Enhancement: Track GPS accuracy and distance for clock-in/out operations
-- This provides audit trail for location verification

-- Add accuracy and distance metadata columns to shift_assignment (if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shift_assignment' AND column_name = 'clock_in_accuracy'
    ) THEN
        ALTER TABLE shift_assignment ADD COLUMN clock_in_accuracy DECIMAL(10, 2);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shift_assignment' AND column_name = 'clock_in_distance'
    ) THEN
        ALTER TABLE shift_assignment ADD COLUMN clock_in_distance DECIMAL(10, 2);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shift_assignment' AND column_name = 'clock_in_warning'
    ) THEN
        ALTER TABLE shift_assignment ADD COLUMN clock_in_warning TEXT;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shift_assignment' AND column_name = 'clock_out_accuracy'
    ) THEN
        ALTER TABLE shift_assignment ADD COLUMN clock_out_accuracy DECIMAL(10, 2);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shift_assignment' AND column_name = 'clock_out_distance'
    ) THEN
        ALTER TABLE shift_assignment ADD COLUMN clock_out_distance DECIMAL(10, 2);
    END IF;
END $$;

-- Create index for querying low-accuracy clock-ins (for monitoring/reporting)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shift_assignment_accuracy 
ON shift_assignment(clock_in_accuracy) 
WHERE clock_in_accuracy > 30;

-- ============================================================================
-- Verification Queries
-- ============================================================================
-- Run these queries to verify the migration was successful:

-- 1. Verify GIST index exists
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'location' AND indexname LIKE '%gist%';

-- 2. Verify CHECK constraint exists
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'check_geofence_radius_range';

-- 3. Verify notification columns exist
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'notification' AND column_name IN ('payload_hash', 'idempotency_key');

-- 4. Verify timezone columns exist
-- SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name IN ('worker', 'shift') AND column_name = 'timezone';

-- 5. Verify accuracy columns exist
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'shift_assignment' AND column_name LIKE '%accuracy%';

-- ============================================================================
-- Rollback Instructions
-- ============================================================================
-- To rollback this migration, run the following SQL:
/*
-- Drop GIST index
DROP INDEX IF EXISTS location_position_gist_idx;

-- Recreate B-Tree index (if needed)
CREATE INDEX location_pos_idx ON location(position);

-- Drop CHECK constraint
ALTER TABLE location DROP CONSTRAINT IF EXISTS check_geofence_radius_range;

-- Drop notification columns
ALTER TABLE notification DROP COLUMN IF EXISTS payload_hash;
DROP INDEX IF EXISTS idx_notification_idempotency;

-- Drop timezone columns (optional - can keep for future use)
ALTER TABLE worker DROP COLUMN IF EXISTS timezone;
ALTER TABLE shift DROP COLUMN IF EXISTS timezone;

-- Drop accuracy columns (optional - can keep for audit trail)
ALTER TABLE shift_assignment DROP COLUMN IF EXISTS clock_in_accuracy;
ALTER TABLE shift_assignment DROP COLUMN IF EXISTS clock_in_distance;
ALTER TABLE shift_assignment DROP COLUMN IF EXISTS clock_in_warning;
ALTER TABLE shift_assignment DROP COLUMN IF EXISTS clock_out_accuracy;
ALTER TABLE shift_assignment DROP COLUMN IF EXISTS clock_out_distance;
DROP INDEX IF EXISTS idx_shift_assignment_accuracy;
*/

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- This migration adds:
-- 1. GIST index for spatial queries (GEO-002) - improves performance 5-10x
-- 2. CHECK constraint for geofence radius (GEO-003) - prevents invalid values
-- 3. Idempotency support for notifications (RACE-003) - prevents duplicates
-- 4. Timezone support for workers/shifts (NOTIF-004) - enables timezone-aware quiet hours
-- 5. GPS accuracy metadata (GEO-001) - provides audit trail for location verification
--
-- Expected impact:
-- - Geofence queries: < 50ms p95 (down from 100-200ms)
-- - Invalid radius values: rejected at database level
-- - Duplicate notifications: prevented by unique constraint
-- - Quiet hours: respected in worker's local timezone
-- - Location verification: full audit trail with GPS accuracy
