# Implementation Plan - Critical Bugs Fix

This implementation plan addresses 12 critical bugs across 4 categories following a phased deployment approach. The plan follows the bug condition methodology with exploration tests, preservation tests, and implementation tasks for each bug category.

## Overview

- **Total Bugs**: 12 (RACE-001 to RACE-003, TENANT-001 to TENANT-003, GEO-001 to GEO-003, NOTIF-001, NOTIF-002, NOTIF-004)
- **Categories**: Race Conditions, Tenant Isolation, Geofencing, Notifications
- **Deployment Phases**: 5 phases (Database Schema, Tenant Isolation, Race Conditions, Geofencing, Notifications)
- **Estimated Timeline**: 4-6 weeks

## Phase 1: Database Schema Changes (Low Risk)

### 1. Exploration Tests - Database Schema

- [x] 1.1 Write exploration test for invalid geofence radius
  - **Property 1: Fault Condition** - Invalid Geofence Radius Acceptance
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples demonstrating invalid radius values are accepted
  - Test that location table accepts geofence_radius values < 10 or > 500 (from GEO-003 Fault Condition)
  - Attempt to insert/update location with radius = 0, 5, 1000, 10000
  - Run test on UNFIXED schema
  - **EXPECTED OUTCOME**: Test FAILS (invalid values are accepted - this is correct, it proves the bug exists)
  - Document counterexamples found (e.g., "location with radius=0 was accepted")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.9, 2.9_

- [x] 1.2 Write exploration test for missing spatial index
  - **Property 1: Fault Condition** - Slow Spatial Queries
  - **CRITICAL**: This test MUST show poor performance on unfixed code
  - **GOAL**: Demonstrate that ST_DWithin queries are slow without GIST index
  - Test geofence query performance on location table with B-Tree index (from GEO-002 Fault Condition)
  - Execute ST_DWithin query and measure execution time
  - Check query plan to verify B-Tree index is used instead of GIST
  - Run test on UNFIXED schema
  - **EXPECTED OUTCOME**: Query time > 100ms and query plan shows B-Tree index
  - Document performance baseline for comparison after fix
  - _Requirements: 1.8, 2.8_

### 2. Preservation Tests - Database Schema

- [x] 2.1 Write preservation test for valid geofence radius
  - **Property 2: Preservation** - Valid Radius Operations
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: location with radius=100 is accepted on unfixed schema
  - Observe: location with radius=50 is accepted on unfixed schema
  - Write test: for all radius values between 10 and 500, location insert/update succeeds
  - Verify test passes on UNFIXED schema
  - **EXPECTED OUTCOME**: Test PASSES (confirms baseline behavior to preserve)
  - _Requirements: 3.9_

- [x] 2.2 Write preservation test for spatial query correctness
  - **Property 2: Preservation** - Correct Distance Calculations
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: ST_DWithin returns correct boolean results on unfixed schema
  - Observe: ST_Distance returns correct distance values on unfixed schema
  - Write test: for various location pairs, verify distance calculations are accurate
  - Verify test passes on UNFIXED schema
  - **EXPECTED OUTCOME**: Test PASSES (confirms correct results to preserve)
  - _Requirements: 3.8_


### 3. Database Schema Implementation

- [-] 3. Implement database schema changes

  - [x] 3.1 Create migration script for Phase 1 schema changes
    - Create migration file: `migrations/001_add_indexes_and_constraints.ts`
    - Include GIST index creation for location.position (GEO-002)
    - Include CHECK constraint for geofence_radius (GEO-003)
    - Include unique index for notification.idempotency_key (RACE-003)
    - Include timezone columns for worker and shift tables (NOTIF-004)
    - Include payload_hash column for notification table (RACE-003)
    - Include accuracy metadata columns for shift_assignment (GEO-001)
    - Use CONCURRENTLY option for index creation to avoid locks
    - _Bug_Condition: GEO-002 (missing GIST index), GEO-003 (no radius constraint)_
    - _Expected_Behavior: Spatial queries use GIST index, invalid radius rejected_
    - _Preservation: Valid radius values work, spatial queries return correct results_
    - _Requirements: 1.8, 1.9, 2.8, 2.9, 3.8, 3.9_

  - [x] 3.2 Fix existing invalid geofence radius data
    - Query location table for radius < 10 OR radius > 500 OR radius IS NULL
    - Update invalid values: NULL → 100, < 10 → 10, > 500 → 500
    - Document number of records fixed
    - _Bug_Condition: Existing data with invalid radius values_
    - _Expected_Behavior: All radius values within 10-500 range_
    - _Requirements: 1.9, 2.9_

  - [ ] 3.3 Run migration in staging environment
    - Execute migration script with CONCURRENTLY option
    - Verify indexes created: `\d location`, `\d notification`
    - Verify constraints active: `\d+ location`
    - Test constraint with invalid data: attempt radius = 5
    - Monitor index usage: check pg_stat_user_indexes
    - _Requirements: 2.8, 2.9_

  - [ ] 3.4 Verify exploration tests now show expected behavior
    - **Property 1: Expected Behavior** - Schema Constraints Active
    - **IMPORTANT**: Re-run the SAME tests from tasks 1.1 and 1.2
    - Re-run invalid radius test - should now FAIL to insert invalid values
    - Re-run spatial query test - should now show improved performance
    - **EXPECTED OUTCOME**: Tests confirm constraints work and performance improved
    - _Requirements: 2.8, 2.9_

  - [ ] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Valid Operations Unchanged
    - **IMPORTANT**: Re-run the SAME tests from tasks 2.1 and 2.2
    - Re-run valid radius test - should still PASS
    - Re-run spatial query correctness test - should still PASS
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - _Requirements: 3.8, 3.9_

  - [ ] 3.6 Deploy migration to production
    - Schedule deployment during low-traffic window
    - Execute migration with monitoring
    - Verify indexes and constraints created successfully
    - Monitor database performance metrics
    - _Requirements: 2.8, 2.9_

- [ ] 4. Checkpoint - Phase 1 Complete
  - Verify all Phase 1 tests pass
  - Confirm indexes and constraints are active in production
  - Review monitoring dashboards for any anomalies
  - Document any issues encountered

## Phase 2: Tenant Isolation Fixes (High Priority - Security Critical)

### 5. Exploration Tests - Tenant Isolation

- [x] 5.1 Write exploration test for availability query leak
  - **Property 1: Fault Condition** - Cross-Tenant Availability Exposure
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **GOAL**: Demonstrate that availability queries return data from other organizations
  - Test that worker availability query in publish.ts returns cross-tenant data (from TENANT-001 Fault Condition)
  - Setup: Create workers in org-a and org-b with availability records
  - Query availability for org-a workers without organizationId filter
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (returns org-b data - this proves the bug exists)
  - Document counterexamples (e.g., "query for org-a returned worker-org-b availability")
  - _Requirements: 1.4, 2.4_

- [ ] 5.2 Write exploration test for location ingestion leak
  - **Property 1: Fault Condition** - Cross-Tenant Location Access
  - **CRITICAL**: This test MUST FAIL on unfixed code
  - **GOAL**: Demonstrate that location queries access data from other organizations
  - Test that location ingestion queries in ingest-location.ts access cross-tenant data (from TENANT-002 Fault Condition)
  - Setup: Create location data for workers in different organizations
  - Execute location ingestion without organizationId filter
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (accesses other org data - this proves the bug exists)
  - Document counterexamples found
  - _Requirements: 1.5, 2.5_

- [ ] 5.3 Write exploration test for invitation bypass
  - **Property 1: Fault Condition** - Unauthorized Invitation Creation
  - **CRITICAL**: This test MUST FAIL on unfixed code
  - **GOAL**: Demonstrate that non-admins can create invitations
  - Test that non-admin users can create invitations in auth.ts (from TENANT-003 Fault Condition)
  - Setup: Create non-admin user in org-a
  - Attempt to create invitation as non-admin
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (invitation created - this proves the bug exists)
  - Document counterexamples (e.g., "non-admin user-123 created invitation for org-a")
  - _Requirements: 1.6, 2.6_

### 6. Preservation Tests - Tenant Isolation

- [ ] 6.1 Write preservation test for same-tenant availability queries
  - **Property 2: Preservation** - Correct Same-Tenant Results
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: availability query with organizationId filter returns correct results on unfixed code
  - Write test: for workers within same organization, availability queries return correct conflicts
  - Verify test passes on UNFIXED code
  - **EXPECTED OUTCOME**: Test PASSES (confirms baseline behavior to preserve)
  - _Requirements: 3.4_

- [ ] 6.2 Write preservation test for same-tenant location operations
  - **Property 2: Preservation** - Correct Location Processing
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: location ingestion for same-org workers calculates distances correctly on unfixed code
  - Write test: for workers with active shifts in their organization, location processing works correctly
  - Verify test passes on UNFIXED code
  - **EXPECTED OUTCOME**: Test PASSES (confirms baseline behavior to preserve)
  - _Requirements: 3.5_

- [ ] 6.3 Write preservation test for valid admin invitations
  - **Property 2: Preservation** - Admin Invitation Flow
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: admin users can create invitations successfully on unfixed code
  - Write test: for valid admins, invitation creation and acceptance flow works correctly
  - Verify test passes on UNFIXED code
  - **EXPECTED OUTCOME**: Test PASSES (confirms baseline behavior to preserve)
  - _Requirements: 3.6_


### 7. Tenant Isolation Implementation

- [ ] 7. Implement tenant isolation fixes

  - [ ] 7.1 Fix availability query leak in publish.ts
    - Add organizationId parameter to checkWorkerAvailability function (line 219)
    - Add eq(workerAvailability.organizationId, organizationId) to WHERE clause
    - Update all callers to pass organizationId parameter
    - Add validation to reject requests without organizationId
    - _Bug_Condition: isBugCondition_TENANT001 - query without organizationId filter_
    - _Expected_Behavior: Query returns only same-organization availability data_
    - _Preservation: Same-tenant queries return correct results_
    - _Requirements: 1.4, 2.4, 3.4_

  - [ ] 7.2 Fix location ingestion leak in ingest-location.ts
    - Add organizationId parameter to ingestWorkerLocation function (lines 50-70)
    - Add eq(workerLocation.organizationId, organizationId) to location queries
    - Fix shift assignment query to join with shift table and filter by organizationId
    - Ensure all location queries consistently filter by organizationId
    - _Bug_Condition: isBugCondition_TENANT002 - queries without organizationId filter_
    - _Expected_Behavior: All queries scoped to requesting organization_
    - _Preservation: Same-tenant location processing works correctly_
    - _Requirements: 1.5, 2.5, 3.5_

  - [ ] 7.3 Fix invitation bypass in auth.ts
    - Add admin verification before invitation creation (lines 160-180)
    - Query organizationMembership to verify inviter has role='admin' and status='active'
    - Throw ForbiddenError if inviter is not an admin
    - Add verification during invitation acceptance (defense in depth)
    - _Bug_Condition: isBugCondition_TENANT003 - no admin verification_
    - _Expected_Behavior: Only active admins can create invitations_
    - _Preservation: Valid admin invitation flow works correctly_
    - _Requirements: 1.6, 2.6, 3.6_

  - [ ] 7.4 Create tenant-scoped query helper functions
    - Create src/lib/db/tenant-scoped-queries.ts
    - Implement createTenantScopedQuery wrapper function
    - Implement getWorkerAvailability helper with organizationId filter
    - Implement getWorkerLocation helper with organizationId filter
    - Add validation to ensure organizationId is always provided
    - _Expected_Behavior: Helper functions enforce tenant scoping_
    - _Requirements: 2.4, 2.5_

  - [ ] 7.5 Add tenant context middleware
    - Create src/middleware/tenant-context.ts
    - Implement extractTenantContext middleware to extract organizationId from JWT
    - Attach organizationId to request context
    - Return 403 error if organizationId is missing
    - Apply middleware to all multi-tenant routes
    - _Expected_Behavior: All requests have organization context_
    - _Requirements: 2.4, 2.5, 2.6_

  - [ ] 7.6 Add authorization middleware
    - Create src/middleware/authorization.ts
    - Implement requireOrgAdmin middleware to verify admin status
    - Query organizationMembership to check role and status
    - Return 403 error if user is not an admin
    - Apply to invitation creation endpoint
    - _Expected_Behavior: Only admins can access protected endpoints_
    - _Requirements: 2.6_

  - [ ] 7.7 Verify exploration tests now pass
    - **Property 1: Expected Behavior** - Tenant Isolation Active
    - **IMPORTANT**: Re-run the SAME tests from tasks 5.1, 5.2, and 5.3
    - Re-run availability leak test - should now return only same-org data
    - Re-run location leak test - should now access only same-org data
    - Re-run invitation bypass test - should now reject non-admin attempts
    - **EXPECTED OUTCOME**: Tests PASS (confirms tenant isolation works)
    - _Requirements: 2.4, 2.5, 2.6_

  - [ ] 7.8 Verify preservation tests still pass
    - **Property 2: Preservation** - Same-Tenant Operations Unchanged
    - **IMPORTANT**: Re-run the SAME tests from tasks 6.1, 6.2, and 6.3
    - Re-run same-tenant availability test - should still PASS
    - Re-run same-tenant location test - should still PASS
    - Re-run valid admin invitation test - should still PASS
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - _Requirements: 3.4, 3.5, 3.6_

  - [ ] 7.9 Deploy tenant isolation fixes to staging
    - Deploy code changes to staging environment
    - Run comprehensive tenant isolation integration tests
    - Test with multiple organizations
    - Verify authorization errors are logged correctly
    - Monitor for any cross-tenant queries in database logs
    - _Requirements: 2.4, 2.5, 2.6_

  - [ ] 7.10 Deploy tenant isolation fixes to production
    - Deploy during low-traffic window
    - Monitor error rates and authorization failures
    - Verify no cross-tenant data access in logs
    - Set up alerts for authorization errors
    - _Requirements: 2.4, 2.5, 2.6_

- [ ] 8. Checkpoint - Phase 2 Complete
  - Verify all tenant isolation tests pass in production
  - Confirm zero cross-tenant data access attempts
  - Review authorization error logs
  - Document any issues encountered

## Phase 3: Race Condition Fixes (Medium Priority - Data Integrity)

### 9. Exploration Tests - Race Conditions

- [ ] 9.1 Write exploration test for duplicate clock-out
  - **Property 1: Fault Condition** - Concurrent Clock-Out Race
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **GOAL**: Demonstrate that concurrent clock-out requests both succeed
  - **Scoped PBT Approach**: Scope to concrete failing case - same assignmentId with concurrent requests
  - Test that two concurrent clock-out requests for same assignment both succeed (from RACE-001 Fault Condition)
  - Setup: Create assignment in clocked-in state (actualClockOut = NULL)
  - Fire two concurrent clock-out requests using Promise.allSettled
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (both requests succeed - this proves the bug exists)
  - Document counterexamples (e.g., "both requests updated assignment-123")
  - _Requirements: 1.1, 2.1_

- [ ] 9.2 Write exploration test for double-booking workers
  - **Property 1: Fault Condition** - Concurrent Shift Publishing Race
  - **CRITICAL**: This test MUST FAIL on unfixed code
  - **GOAL**: Demonstrate that concurrent shift assignments create double-booking
  - **Scoped PBT Approach**: Scope to concrete failing case - same worker with overlapping time ranges
  - Test that concurrent shift publishing for same worker creates overlapping assignments (from RACE-002 Fault Condition)
  - Setup: Create worker with no existing assignments
  - Fire two concurrent publishShift requests for overlapping time ranges
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (both assignments created - this proves the bug exists)
  - Document counterexamples (e.g., "worker-123 assigned to 2 overlapping shifts")
  - _Requirements: 1.2, 2.2_

- [ ] 9.3 Write exploration test for duplicate notifications
  - **Property 1: Fault Condition** - Concurrent Notification Scheduling Race
  - **CRITICAL**: This test MUST FAIL on unfixed code
  - **GOAL**: Demonstrate that concurrent requests with same idempotency key create duplicates
  - **Scoped PBT Approach**: Scope to concrete failing case - same key with different payloads
  - Test that concurrent notification requests with same key but different payloads create duplicates (from RACE-003 Fault Condition)
  - Setup: No existing notifications with test idempotency key
  - Fire two concurrent scheduleNotification requests with same key, different payloads
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (both notifications created - this proves the bug exists)
  - Document counterexamples (e.g., "2 notifications created with key 'shift-reminder-123'")
  - _Requirements: 1.3, 2.3_

### 10. Preservation Tests - Race Conditions

- [ ] 10.1 Write preservation test for single clock-out operations
  - **Property 2: Preservation** - Non-Concurrent Clock-Out
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: single clock-out request succeeds and updates assignment correctly on unfixed code
  - Write test: for single clock-out without concurrent conflicts, verify success and correct data
  - Verify test passes on UNFIXED code
  - **EXPECTED OUTCOME**: Test PASSES (confirms baseline behavior to preserve)
  - _Requirements: 3.1_

- [ ] 10.2 Write preservation test for non-overlapping shift publishing
  - **Property 2: Preservation** - Non-Conflicting Assignments
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: shift publishing for different workers or non-overlapping times succeeds on unfixed code
  - Write test: for non-conflicting shift assignments, verify batch creation works correctly
  - Verify test passes on UNFIXED code
  - **EXPECTED OUTCOME**: Test PASSES (confirms baseline behavior to preserve)
  - _Requirements: 3.2_

- [ ] 10.3 Write preservation test for unique idempotency keys
  - **Property 2: Preservation** - Unique Key Idempotency
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: notification requests with unique keys create separate notifications on unfixed code
  - Observe: duplicate requests with same key and payload return cached response on unfixed code
  - Write test: for unique keys and matching payloads, verify correct idempotency behavior
  - Verify test passes on UNFIXED code
  - **EXPECTED OUTCOME**: Test PASSES (confirms baseline behavior to preserve)
  - _Requirements: 3.3_


### 11. Race Condition Implementation

- [ ] 11. Implement race condition fixes

  - [ ] 11.1 Implement optimistic locking for clock-out (RACE-001)
    - Update clock-out handler in src/services/clock-out.ts
    - Replace check-then-act pattern with atomic UPDATE with WHERE clause guard
    - Add WHERE clause: actualClockOut IS NULL to prevent duplicate updates
    - Check UPDATE result - if 0 rows affected, query to determine if not found or already clocked out
    - Throw ConflictError if already clocked out
    - Wrap in transaction for related shift status updates
    - _Bug_Condition: isBugCondition_RACE001 - concurrent requests without locking_
    - _Expected_Behavior: Only one request succeeds, second gets ConflictError_
    - _Preservation: Single clock-out requests work identically_
    - _Requirements: 1.1, 2.1, 3.1_

  - [ ] 11.2 Add exclusion constraint for shift assignments (RACE-002)
    - Create migration file: migrations/003_add_exclusion_constraint.ts
    - Enable btree_gist extension: CREATE EXTENSION IF NOT EXISTS btree_gist
    - Add exclusion constraint: EXCLUDE USING gist (worker_id WITH =, tsrange(scheduled_start, scheduled_end) WITH &&)
    - Add WHERE clause: status != 'cancelled'
    - Test constraint in staging with overlapping assignments
    - _Bug_Condition: isBugCondition_RACE002 - concurrent assignments without constraint_
    - _Expected_Behavior: Database rejects overlapping assignments_
    - _Requirements: 1.2, 2.2_

  - [ ] 11.3 Update shift publishing to handle constraint violations (RACE-002)
    - Update publishShifts function in src/services/publish.ts
    - Wrap in transaction with SERIALIZABLE isolation level
    - Keep validation logic for user feedback
    - Add try-catch to handle constraint violation (error code 23P01)
    - Throw ConflictError with clear message about overlapping shifts
    - _Expected_Behavior: Concurrent requests get clear conflict error_
    - _Preservation: Non-overlapping assignments work with same performance_
    - _Requirements: 1.2, 2.2, 3.2_

  - [ ] 11.4 Implement atomic idempotency checks for notifications (RACE-003)
    - Update scheduleNotification function in src/services/notification/scheduler.ts
    - Add calculatePayloadHash function using crypto.createHash('sha256')
    - Use INSERT with onConflictDoNothing on idempotency_key
    - If insert returns 0 rows, fetch existing notification
    - Compare payload_hash - if different, throw ConflictError
    - If same, return cached notification
    - _Bug_Condition: isBugCondition_RACE003 - non-atomic key and hash check_
    - _Expected_Behavior: Same key with different payload rejected atomically_
    - _Preservation: Unique keys and matching payloads work identically_
    - _Requirements: 1.3, 2.3, 3.3_

  - [ ] 11.5 Add idempotency key generation helper
    - Create helper function: generateIdempotencyKey(type, entityId, timestamp)
    - Format: `${type}:${entityId}:${timestamp.toISOString()}`
    - Document usage examples for shift reminders, notifications
    - Update notification callers to use helper
    - _Expected_Behavior: Consistent idempotency key format_
    - _Requirements: 2.3_

  - [ ] 11.6 Verify exploration tests now pass
    - **Property 1: Expected Behavior** - Race Conditions Prevented
    - **IMPORTANT**: Re-run the SAME tests from tasks 9.1, 9.2, and 9.3
    - Re-run duplicate clock-out test - second request should now fail with ConflictError
    - Re-run double-booking test - second assignment should now fail with constraint violation
    - Re-run duplicate notification test - second request should now fail with ConflictError
    - **EXPECTED OUTCOME**: Tests PASS (confirms race conditions prevented)
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 11.7 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Concurrent Operations Unchanged
    - **IMPORTANT**: Re-run the SAME tests from tasks 10.1, 10.2, and 10.3
    - Re-run single clock-out test - should still PASS
    - Re-run non-overlapping assignments test - should still PASS
    - Re-run unique idempotency keys test - should still PASS
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 11.8 Deploy race condition fixes to staging
    - Deploy exclusion constraint migration
    - Deploy application code changes
    - Test concurrent operations with load testing tools
    - Monitor for constraint violations and conflict errors
    - Verify error messages are clear and actionable
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 11.9 Deploy race condition fixes to production
    - Deploy during low-traffic window
    - Monitor error rates for ConflictError responses
    - Monitor database for constraint violations
    - Verify single-request operations maintain performance
    - Set up alerts for high conflict rates
    - _Requirements: 2.1, 2.2, 2.3_

- [ ] 12. Checkpoint - Phase 3 Complete
  - Verify all race condition tests pass in production
  - Confirm zero duplicate clock-outs, double-bookings, or duplicate notifications
  - Review conflict error rates
  - Document any issues encountered

## Phase 4: Geofencing Fixes (Medium Priority - Location Validation)

### 13. Exploration Tests - Geofencing

- [ ] 13.1 Write exploration test for excessive GPS accuracy
  - **Property 1: Fault Condition** - Low Accuracy Acceptance
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **GOAL**: Demonstrate that clock-in accepts GPS accuracy > 50 meters
  - Test that clock-in with accuracy = 180 meters is accepted (from GEO-001 Fault Condition)
  - Setup: Create shift assignment ready for clock-in
  - Attempt clock-in with location accuracy = 180m, 200m
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (clock-in accepted - this proves the bug exists)
  - Document counterexamples (e.g., "clock-in accepted with 180m accuracy")
  - _Requirements: 1.7, 2.7_

### 14. Preservation Tests - Geofencing

- [ ] 14.1 Write preservation test for valid GPS accuracy
  - **Property 2: Preservation** - High Accuracy Clock-In
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: clock-in with accuracy < 50m succeeds and verifies location on unfixed code
  - Write test: for GPS accuracy 10m, 30m, 45m within geofence, verify clock-in succeeds
  - Verify test passes on UNFIXED code
  - **EXPECTED OUTCOME**: Test PASSES (confirms baseline behavior to preserve)
  - _Requirements: 3.7_

- [ ] 14.2 Write preservation test for geofence validation logic
  - **Property 2: Preservation** - Correct Geofence Checks
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: geofence validation correctly identifies within/outside geofence on unfixed code
  - Write test: for various distances and geofence radii, verify correct isWithin results
  - Verify test passes on UNFIXED code
  - **EXPECTED OUTCOME**: Test PASSES (confirms baseline behavior to preserve)
  - _Requirements: 3.7, 3.8_

### 15. Geofencing Implementation

- [ ] 15. Implement geofencing fixes

  - [ ] 15.1 Create geofence configuration constants
    - Create src/config/geofence.ts
    - Define MAX_GPS_ACCURACY_METERS = 50
    - Define RECOMMENDED_ACCURACY_METERS = 30
    - Define MIN_GEOFENCE_RADIUS_METERS = 10
    - Define MAX_GEOFENCE_RADIUS_METERS = 500
    - Export configuration object
    - _Expected_Behavior: Centralized geofence configuration_
    - _Requirements: 2.7, 2.9_

  - [ ] 15.2 Add GPS accuracy validation to clock-in handler
    - Update clockIn function in src/services/clock-in.ts (lines 35-40)
    - Add validation: if accuracy > MAX_GPS_ACCURACY_METERS, throw ValidationError
    - Add warning: if accuracy > RECOMMENDED_ACCURACY_METERS, set warning message
    - Update response to include accuracy and warning
    - _Bug_Condition: isBugCondition_GEO001 - no accuracy validation_
    - _Expected_Behavior: Reject accuracy > 50m with clear error message_
    - _Preservation: Accuracy < 50m works identically_
    - _Requirements: 1.7, 2.7, 3.7_

  - [ ] 15.3 Add accuracy metadata to clock-in records
    - Update clock-in handler to record clock_in_accuracy
    - Record clock_in_distance from geofence check
    - Record clock_in_warning if accuracy is suboptimal
    - Add same fields for clock-out operations
    - _Expected_Behavior: Audit trail for GPS accuracy_
    - _Requirements: 2.7_

  - [ ] 15.4 Add validation schema for location updates
    - Create src/lib/validation/geofence.ts
    - Define GeofenceRadiusSchema using Zod: z.number().int().min(10).max(500)
    - Define LocationSchema with all location fields
    - Export schemas for use in API handlers
    - _Expected_Behavior: Type-safe validation for location data_
    - _Requirements: 2.9_

  - [ ] 15.5 Add application-level validation for geofence radius
    - Update createLocation and updateLocation functions
    - Use GeofenceRadiusSchema to validate radius input
    - Handle validation errors with clear messages
    - Add database error handler for CHECK constraint violations (error code 23514)
    - _Expected_Behavior: User-friendly validation errors_
    - _Preservation: Valid radius values work identically_
    - _Requirements: 2.9, 3.9_

  - [ ] 15.6 Update mobile app for high-accuracy GPS
    - Add getLocationForClockIn helper function
    - Request GPS with enableHighAccuracy: true
    - Validate accuracy client-side before sending to server
    - Show user-friendly message if GPS signal is weak
    - _Expected_Behavior: Better GPS accuracy from mobile devices_
    - _Requirements: 2.7_

  - [ ] 15.7 Verify exploration test now passes
    - **Property 1: Expected Behavior** - GPS Accuracy Validation Active
    - **IMPORTANT**: Re-run the SAME test from task 13.1
    - Re-run excessive accuracy test - should now reject with ValidationError
    - **EXPECTED OUTCOME**: Test PASSES (confirms accuracy validation works)
    - _Requirements: 2.7_

  - [ ] 15.8 Verify preservation tests still pass
    - **Property 2: Preservation** - Valid Geofence Operations Unchanged
    - **IMPORTANT**: Re-run the SAME tests from tasks 14.1 and 14.2
    - Re-run valid accuracy test - should still PASS
    - Re-run geofence validation test - should still PASS
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - _Requirements: 3.7, 3.8, 3.9_

  - [ ] 15.9 Deploy geofencing fixes to staging
    - Deploy GPS accuracy validation code
    - Deploy mobile app updates
    - Test clock-in with various GPS accuracy values
    - Monitor clock-in success rates
    - Verify geofence query performance with GIST index
    - _Requirements: 2.7, 2.8, 2.9_

  - [ ] 15.10 Deploy geofencing fixes to production
    - Deploy during low-traffic window
    - Monitor clock-in rejection rates due to accuracy
    - Monitor geofence query performance (should be < 50ms p95)
    - Adjust accuracy threshold if rejection rate is too high
    - Set up alerts for high rejection rates
    - _Requirements: 2.7, 2.8, 2.9_

- [ ] 16. Checkpoint - Phase 4 Complete
  - Verify all geofencing tests pass in production
  - Confirm clock-in success rate > 95%
  - Confirm geofence query p95 < 50ms
  - Review GPS accuracy distribution
  - Document any issues encountered


## Phase 5: Notification System Fixes (Low Priority - User Experience)

### 17. Exploration Tests - Notifications

- [ ] 17.1 Write exploration test for token mapping loss
  - **Property 1: Fault Condition** - Incorrect Token Attribution
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **GOAL**: Demonstrate that token-to-message mapping is lost during batch processing
  - Test that batch notification errors are attributed to wrong tokens (from NOTIF-001 Fault Condition)
  - Setup: Create batch with 100 tokens, include 5 invalid tokens at specific indices
  - Send batch through expo-push.ts filtering and chunking
  - Verify error attribution after filtering shifts indices
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (errors attributed to wrong tokens - this proves the bug exists)
  - Document counterexamples (e.g., "error for token at index 50 attributed to token at index 45")
  - _Requirements: 1.10, 2.10_

- [ ] 17.2 Write exploration test for duplicate token notifications
  - **Property 1: Fault Condition** - Duplicate Notifications Sent
  - **CRITICAL**: This test MUST FAIL on unfixed code
  - **GOAL**: Demonstrate that workers with duplicate tokens receive multiple notifications
  - Test that worker with duplicate device tokens receives notification multiple times (from NOTIF-002 Fault Condition)
  - Setup: Register same pushToken multiple times for one worker
  - Send notification to worker
  - Verify notification sent to duplicate tokens
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (multiple sends to same token - this proves the bug exists)
  - Document counterexamples (e.g., "worker-123 has 3 registrations of token-abc, received 3 notifications")
  - _Requirements: 1.11, 2.11_

- [ ] 17.3 Write exploration test for timezone-unaware quiet hours
  - **Property 1: Fault Condition** - Server Time Quiet Hours Check
  - **CRITICAL**: This test MUST FAIL on unfixed code
  - **GOAL**: Demonstrate that quiet hours use server time instead of worker timezone
  - Test that quiet hours check in scheduler.ts uses server time (from NOTIF-004 Fault Condition)
  - Setup: Worker in timezone America/New_York with quiet hours 22:00-08:00
  - Schedule notification for 23:00 EST (which is 04:00 UTC if server is UTC)
  - Verify notification is sent (should be blocked but isn't due to server time check)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (notification sent during local quiet hours - this proves the bug exists)
  - Document counterexamples (e.g., "worker in EST received notification at 23:00 local time")
  - _Requirements: 1.12, 2.12_

### 18. Preservation Tests - Notifications

- [ ] 18.1 Write preservation test for single-token notifications
  - **Property 2: Preservation** - Single Token Delivery
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: workers with single unique token receive notifications correctly on unfixed code
  - Write test: for workers with one device token, verify notification delivered exactly once
  - Verify test passes on UNFIXED code
  - **EXPECTED OUTCOME**: Test PASSES (confirms baseline behavior to preserve)
  - _Requirements: 3.10, 3.11_

- [ ] 18.2 Write preservation test for quiet hours disabled
  - **Property 2: Preservation** - Quiet Hours Disabled Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: workers with quietHoursEnabled=false receive all notifications on unfixed code
  - Write test: for workers with quiet hours disabled, verify notifications sent regardless of time
  - Verify test passes on UNFIXED code
  - **EXPECTED OUTCOME**: Test PASSES (confirms baseline behavior to preserve)
  - _Requirements: 3.12_

### 19. Notification System Implementation

- [ ] 19. Implement notification system fixes

  - [ ] 19.1 Create explicit token-to-notification mapping structure
    - Update src/services/notification/expo-push.ts (lines 70-80)
    - Define NotificationWithToken interface with notificationId, pushToken, message, originalIndex
    - Define SendResult interface with notificationId, pushToken, status, ticketId, error
    - _Expected_Behavior: Type-safe mapping structure_
    - _Requirements: 2.10_

  - [ ] 19.2 Implement mapping-preserving batch send logic
    - Refactor sendBatchNotifications to create explicit mapping array
    - Filter invalid tokens while preserving mapping (keep notificationId and pushToken)
    - Chunk messages while preserving mapping (use NotificationWithToken objects)
    - Map Expo tickets back to original notifications using preserved mapping
    - Ensure each error is attributed to correct token
    - _Bug_Condition: isBugCondition_NOTIF001 - mapping lost during filtering/chunking_
    - _Expected_Behavior: Errors attributed to correct tokens_
    - _Preservation: Single-token notifications work identically_
    - _Requirements: 1.10, 2.10, 3.10_

  - [ ] 19.3 Implement token status tracking
    - Create markTokenInactive function with pushToken and reason parameters
    - Query deviceToken table for all devices with pushToken
    - Update status='inactive', set inactiveReason and inactiveAt
    - Log number of devices marked inactive
    - _Expected_Behavior: Correct tokens marked inactive_
    - _Requirements: 2.10_

  - [ ] 19.4 Implement notification status updates
    - Create updateNotificationStatuses function
    - Accept SendResult array with notificationId, status, error, ticketId
    - Use transaction to atomically update all notification records
    - Set status='sent' or 'failed', sentAt, errorMessage, ticketId
    - _Expected_Behavior: Accurate notification delivery tracking_
    - _Requirements: 2.10_

  - [ ] 19.5 Add comprehensive notification logging
    - Create src/lib/logging/notification-logger.ts
    - Implement logNotificationBatch function
    - Log summary: total, sent, failed counts
    - Log errors with notificationId and truncated pushToken
    - Send metrics to monitoring service
    - _Expected_Behavior: Detailed audit trail for debugging_
    - _Requirements: 2.10_

  - [ ] 19.6 Implement token deduplication logic
    - Create deduplicateTokens function
    - Use Map to track seen pushToken values
    - For duplicates, keep most recently used token (lastUsedAt)
    - Log duplicate detection with token prefix
    - Return array of unique tokens
    - _Bug_Condition: isBugCondition_NOTIF002 - no deduplication_
    - _Expected_Behavior: Each unique token receives notification once_
    - _Requirements: 1.11, 2.11_

  - [ ] 19.7 Update sendNotificationToWorker with deduplication
    - Query all active tokens for worker
    - Call deduplicateTokens before sending
    - Log: "Worker X: Y total tokens, Z unique tokens after deduplication"
    - Send to unique tokens only
    - _Expected_Behavior: Workers receive one notification per unique device_
    - _Preservation: Single-token workers receive one notification_
    - _Requirements: 2.11, 3.11_

  - [ ] 19.8 Add unique constraint for device tokens (optional)
    - Create migration to add unique index on (worker_id, push_token) WHERE status='active'
    - Test constraint with duplicate token registration attempts
    - _Expected_Behavior: Database prevents duplicate token registrations_
    - _Requirements: 2.11_

  - [ ] 19.9 Update token registration with upsert pattern
    - Modify registerDeviceToken function
    - Check for existing token with same workerId and pushToken
    - If exists, update lastUsedAt and status='active'
    - If not exists, insert new token
    - Handle unique constraint violation gracefully
    - _Expected_Behavior: Token registration is idempotent_
    - _Requirements: 2.11_

  - [ ] 19.10 Create token cleanup script
    - Create scripts/cleanup-duplicate-tokens.ts
    - Query for workers with duplicate active tokens (GROUP BY worker_id, push_token HAVING COUNT(*) > 1)
    - For each duplicate group, keep most recently used, deactivate others
    - Log cleanup actions
    - Run as one-time migration before deployment
    - _Expected_Behavior: Existing duplicates cleaned up_
    - _Requirements: 2.11_

  - [ ] 19.11 Install timezone library
    - Add date-fns-tz to package.json: npm install date-fns-tz
    - Import utcToZonedTime and format functions
    - _Expected_Behavior: Timezone conversion support_
    - _Requirements: 2.12_

  - [ ] 19.12 Implement timezone-aware quiet hours check
    - Create shouldSendNotification function in src/services/notification/scheduler.ts
    - Accept scheduledTime and QuietHoursConfig (enabled, startHour, endHour, timezone)
    - Convert scheduledTime to worker's timezone using utcToZonedTime
    - Extract hour and check against quiet hours range
    - Handle quiet hours spanning midnight (startHour > endHour)
    - Return boolean indicating whether to send
    - _Bug_Condition: isBugCondition_NOTIF004 - uses server time_
    - _Expected_Behavior: Quiet hours checked in worker's local timezone_
    - _Requirements: 1.12, 2.12_

  - [ ] 19.13 Implement isInQuietHours helper
    - Create function to check if hour is within quiet hours range
    - Handle normal case: startHour < endHour (e.g., 08:00-22:00)
    - Handle midnight-spanning case: startHour > endHour (e.g., 22:00-08:00)
    - Return boolean
    - _Expected_Behavior: Correct quiet hours detection_
    - _Requirements: 2.12_

  - [ ] 19.14 Implement calculateNextAvailableTime helper
    - Create function to reschedule notifications outside quiet hours
    - Convert to worker timezone, check if in quiet hours
    - If in quiet hours, schedule for end of quiet hours
    - Handle midnight-spanning quiet hours
    - Convert back to UTC
    - _Expected_Behavior: Notifications rescheduled to after quiet hours_
    - _Requirements: 2.12_

  - [ ] 19.15 Update scheduleNotification with timezone-aware logic
    - Fetch worker with timezone and quiet hours settings
    - Create QuietHoursConfig object
    - Call shouldSendNotification with worker's timezone
    - If in quiet hours, call calculateNextAvailableTime
    - Log rescheduling actions
    - Create notification with adjusted scheduledFor time
    - _Expected_Behavior: Quiet hours respected in worker's timezone_
    - _Preservation: Workers with quiet hours disabled receive all notifications_
    - _Requirements: 2.12, 3.12_

  - [ ] 19.16 Create timezone migration script
    - Create scripts/migrate-worker-timezones.ts
    - Query workers with NULL or empty timezone
    - Infer timezone from organization.timezone or default to UTC
    - Update worker.timezone for all workers
    - Log migration actions
    - Run before deployment
    - _Expected_Behavior: All workers have timezone set_
    - _Requirements: 2.12_

  - [ ] 19.17 Verify exploration tests now pass
    - **Property 1: Expected Behavior** - Notification Fixes Active
    - **IMPORTANT**: Re-run the SAME tests from tasks 17.1, 17.2, and 17.3
    - Re-run token mapping test - errors should now be attributed correctly
    - Re-run duplicate token test - worker should receive notification once
    - Re-run timezone test - notification should be blocked during local quiet hours
    - **EXPECTED OUTCOME**: Tests PASS (confirms notification fixes work)
    - _Requirements: 2.10, 2.11, 2.12_

  - [ ] 19.18 Verify preservation tests still pass
    - **Property 2: Preservation** - Notification Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from tasks 18.1 and 18.2
    - Re-run single-token test - should still PASS
    - Re-run quiet hours disabled test - should still PASS
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - _Requirements: 3.10, 3.11, 3.12_

  - [ ] 19.19 Deploy notification fixes to staging
    - Run token cleanup script
    - Run timezone migration script
    - Deploy code changes
    - Test token mapping with batch notifications
    - Test duplicate token handling
    - Test quiet hours with different timezones
    - Monitor notification delivery rates
    - _Requirements: 2.10, 2.11, 2.12_

  - [ ] 19.20 Deploy notification fixes to production
    - Run cleanup and migration scripts in production
    - Deploy during low-traffic window
    - Monitor notification delivery success rate (should be > 95%)
    - Monitor token deduplication metrics
    - Monitor quiet hours rescheduling metrics
    - Set up alerts for delivery rate drops
    - _Requirements: 2.10, 2.11, 2.12_

- [ ] 20. Checkpoint - Phase 5 Complete
  - Verify all notification tests pass in production
  - Confirm notification delivery rate > 95%
  - Confirm correct token attribution in logs
  - Confirm quiet hours respected in worker timezones
  - Document any issues encountered

## Final Validation and Monitoring

- [ ] 21. Comprehensive integration testing
  - Run full test suite across all bug categories
  - Test interactions between fixes (e.g., tenant isolation + race conditions)
  - Perform load testing to verify performance under concurrent load
  - Test rollback procedures for each phase
  - Document test results and any issues

- [ ] 22. Set up monitoring and alerting
  - Configure metrics collection for all bug categories
  - Set up alerts for error rate increases
  - Set up alerts for performance degradation
  - Set up alerts for security violations (cross-tenant access)
  - Create monitoring dashboard for all key metrics
  - Document alert thresholds and escalation procedures

- [ ] 23. Update documentation
  - Update API documentation with new error codes (ConflictError, ForbiddenError, ValidationError)
  - Create admin guide for geofence radius configuration
  - Create worker guide for timezone settings and quiet hours
  - Create developer guide for tenant-scoped queries and authorization
  - Create runbook for monitoring and troubleshooting
  - Document rollback procedures for each phase

- [ ] 24. Conduct post-deployment review
  - Review all metrics and logs from production deployment
  - Verify all 12 bugs are fixed and no regressions introduced
  - Document lessons learned and deployment challenges
  - Update deployment procedures based on experience
  - Schedule follow-up review in 1 week to assess stability

- [ ] 25. Final checkpoint - All phases complete
  - Confirm all 12 critical bugs are fixed in production
  - Verify all success metrics are met:
    - Zero cross-tenant data access attempts
    - Zero duplicate clock-outs, double-bookings, or duplicate notifications
    - Clock-in success rate > 95%
    - Geofence query p95 < 50ms
    - Notification delivery rate > 95%
  - Ensure all tests pass, ask the user if questions arise

