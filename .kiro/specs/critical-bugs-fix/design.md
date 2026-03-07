# Critical Bugs Fix - Technical Design

## Overview

This design document provides comprehensive technical solutions for 12 critical bugs in the Pavn (WorkersHive) workforce management platform. The bugs span four categories: race conditions in concurrent operations, tenant isolation vulnerabilities, geofencing validation issues, and notification system bugs. The fixes prioritize data integrity, security, and backward compatibility while maintaining system performance.

The design follows the bug condition methodology, identifying fault conditions (C), expected properties (P), and preservation requirements (¬C) for each bug category. Solutions leverage database-level concurrency controls, proper query scoping, spatial indexing, and explicit state management to ensure correctness.

## Glossary

- **Bug_Condition (C)**: The condition that triggers each bug - concurrent operations, missing tenant filters, invalid geofence data, or incorrect notification handling
- **Property (P)**: The desired behavior when bugs are fixed - atomic operations, proper isolation, accurate geofencing, correct notification delivery
- **Preservation**: Existing functionality that must remain unchanged - single-request operations, same-tenant queries, valid geofence operations, single-token notifications
- **Race Condition**: Concurrent operations that can corrupt data due to check-then-act patterns without proper locking
- **Tenant Isolation**: Ensuring data queries are scoped to a single organization to prevent cross-tenant data leaks
- **Geofencing**: Location-based validation using spatial queries to verify workers are within acceptable distance of venues
- **Idempotency**: Ensuring duplicate requests with the same key produce the same result without side effects
- **Optimistic Locking**: Concurrency control using version numbers or WHERE clause guards to detect conflicts
- **Pessimistic Locking**: Concurrency control using SELECT FOR UPDATE to lock rows during transactions
- **GIST Index**: Generalized Search Tree index optimized for spatial data queries in PostgreSQL
- **ST_DWithin**: PostGIS function to check if geometries are within a specified distance

## Bug Details


### Category 1: Race Conditions

#### Fault Condition - RACE-001: Duplicate Clock-Out

The bug manifests when two concurrent requests attempt to clock out the same shift assignment. The system performs a SELECT to check status followed by an UPDATE, allowing both requests to pass the check and execute conflicting updates.

**Formal Specification:**
```
FUNCTION isBugCondition_RACE001(request1, request2)
  INPUT: request1, request2 of type ClockOutRequest
  OUTPUT: boolean
  
  RETURN request1.shiftAssignmentId == request2.shiftAssignmentId
         AND request1.timestamp OVERLAPS request2.timestamp (within ~100ms)
         AND assignment.actualClockOut IS NULL (at time of both checks)
         AND NOT (database_lock_held OR optimistic_version_check)
END FUNCTION
```

#### Fault Condition - RACE-002: Double-Booking Workers

The bug manifests when multiple shift publishing requests check for worker availability overlaps before inserting assignments. Concurrent requests can pass validation simultaneously and insert conflicting assignments.

**Formal Specification:**
```
FUNCTION isBugCondition_RACE002(request1, request2)
  INPUT: request1, request2 of type PublishShiftRequest
  OUTPUT: boolean
  
  RETURN EXISTS worker IN (request1.workers INTERSECT request2.workers)
         AND request1.timeRange OVERLAPS request2.timeRange
         AND request1.timestamp OVERLAPS request2.timestamp (within ~500ms)
         AND NOT (serializable_isolation OR unique_constraint_exists)
END FUNCTION
```

#### Fault Condition - RACE-003: Duplicate Notifications

The bug manifests when duplicate notification scheduling requests arrive with the same idempotency key but different payload hashes, creating multiple notification records.

**Formal Specification:**
```
FUNCTION isBugCondition_RACE003(request1, request2)
  INPUT: request1, request2 of type ScheduleNotificationRequest
  OUTPUT: boolean
  
  RETURN request1.idempotencyKey == request2.idempotencyKey
         AND request1.payloadHash != request2.payloadHash
         AND request1.timestamp OVERLAPS request2.timestamp (within ~200ms)
         AND NOT (atomic_key_and_hash_check)
END FUNCTION
```


### Category 2: Tenant Isolation Vulnerabilities

#### Fault Condition - TENANT-001: Availability Query Leak

The bug manifests when the shift publishing service queries worker availability without filtering by organizationId, potentially exposing data from other organizations.

**Formal Specification:**
```
FUNCTION isBugCondition_TENANT001(query)
  INPUT: query of type WorkerAvailabilityQuery
  OUTPUT: boolean
  
  RETURN query.targetFile == "publish.ts"
         AND query.lineNumber IN [215, 225]
         AND "organizationId" NOT IN query.whereClause
         AND query.table == "workerAvailability"
END FUNCTION
```

#### Fault Condition - TENANT-002: Location Ingestion Leak

The bug manifests when location ingestion queries workerLocation and shiftAssignment tables without consistently filtering by organizationId.

**Formal Specification:**
```
FUNCTION isBugCondition_TENANT002(query)
  INPUT: query of type LocationQuery
  OUTPUT: boolean
  
  RETURN query.targetFile == "ingest-location.ts"
         AND query.lineNumber IN [50, 70]
         AND ("organizationId" NOT IN query.whereClause OR query.joinMissingOrgFilter)
         AND query.table IN ["workerLocation", "shiftAssignment"]
END FUNCTION
```

#### Fault Condition - TENANT-003: Invitation Token Bypass

The bug manifests when a user creates an invitation token without verification that the inviter is an admin of the target organization.

**Formal Specification:**
```
FUNCTION isBugCondition_TENANT003(request)
  INPUT: request of type CreateInvitationRequest
  OUTPUT: boolean
  
  RETURN request.targetFile == "auth.ts"
         AND request.lineNumber IN [160, 180]
         AND NOT (inviter_admin_check_exists)
         AND request.inviterId NOT IN (SELECT userId FROM organizationMembership 
                                        WHERE organizationId = request.organizationId 
                                        AND role = 'admin' AND status = 'active')
END FUNCTION
```


### Category 3: Geofencing Issues

#### Fault Condition - GEO-001: Excessive GPS Accuracy

The bug manifests when a worker attempts to clock in with GPS accuracy of 200 meters, allowing clock-ins from far outside the actual building location.

**Formal Specification:**
```
FUNCTION isBugCondition_GEO001(clockInRequest)
  INPUT: clockInRequest of type ClockInRequest
  OUTPUT: boolean
  
  RETURN clockInRequest.targetFile == "clock-in.ts"
         AND clockInRequest.lineNumber IN [35, 40]
         AND clockInRequest.gpsAccuracy > 50 (meters)
         AND clockInRequest.gpsAccuracy <= 200 (current threshold)
         AND system_accepts_location == true
END FUNCTION
```

#### Fault Condition - GEO-002: Missing Spatial Index

The bug manifests when geofence queries execute ST_DWithin operations using B-Tree indexes instead of GIST indexes, causing slow performance.

**Formal Specification:**
```
FUNCTION isBugCondition_GEO002(query)
  INPUT: query of type SpatialQuery
  OUTPUT: boolean
  
  RETURN query.targetFile == "clock-in.ts"
         AND query.lineNumber IN [60, 75]
         AND query.operation == "ST_DWithin"
         AND query.column == "position"
         AND index_type(query.column) == "btree" (not GIST)
         AND query.executionTime > acceptable_threshold
END FUNCTION
```

#### Fault Condition - GEO-003: Invalid Geofence Radius

The bug manifests when an admin sets a geofence radius without min/max constraints, allowing invalid values like 0 or 10000 meters.

**Formal Specification:**
```
FUNCTION isBugCondition_GEO003(updateRequest)
  INPUT: updateRequest of type UpdateLocationRequest
  OUTPUT: boolean
  
  RETURN updateRequest.table == "location"
         AND updateRequest.column == "geofenceRadius"
         AND (updateRequest.value < 10 OR updateRequest.value > 500)
         AND NOT (check_constraint_exists)
         AND system_accepts_value == true
END FUNCTION
```


### Category 4: Notification System Issues

#### Fault Condition - NOTIF-001: Token Mapping Loss

The bug manifests when batch notifications are sent and the token-to-message mapping becomes unreliable after filtering, causing wrong tokens to be marked inactive.

**Formal Specification:**
```
FUNCTION isBugCondition_NOTIF001(batchProcess)
  INPUT: batchProcess of type ExpoPushBatchProcess
  OUTPUT: boolean
  
  RETURN batchProcess.targetFile == "expo-push.ts"
         AND batchProcess.lineNumber IN [70, 80]
         AND batchProcess.hasTokenFiltering == true
         AND batchProcess.hasChunking == true
         AND NOT (explicit_token_message_mapping_maintained)
         AND result_attribution_incorrect == true
END FUNCTION
```

#### Fault Condition - NOTIF-002: Duplicate Token Notifications

The bug manifests when a worker has multiple device tokens registered and receives the same notification multiple times without deduplication.

**Formal Specification:**
```
FUNCTION isBugCondition_NOTIF002(notificationRequest)
  INPUT: notificationRequest of type SendNotificationRequest
  OUTPUT: boolean
  
  RETURN COUNT(DISTINCT notificationRequest.tokens) < COUNT(notificationRequest.tokens)
         AND NOT (token_deduplication_exists)
         AND worker_receives_duplicates == true
END FUNCTION
```

#### Fault Condition - NOTIF-004: Timezone-Unaware Quiet Hours

The bug manifests when quiet hours logic checks notification scheduling time against server time without accounting for worker timezone.

**Formal Specification:**
```
FUNCTION isBugCondition_NOTIF004(schedulingCheck)
  INPUT: schedulingCheck of type QuietHoursCheck
  OUTPUT: boolean
  
  RETURN schedulingCheck.targetFile == "scheduler.ts"
         AND schedulingCheck.lineNumber IN [180, 200]
         AND schedulingCheck.usesServerTime == true
         AND NOT (worker_timezone_conversion_exists)
         AND worker.timezone != server.timezone
         AND notification_sent_during_local_quiet_hours == true
END FUNCTION
```


### Examples

**RACE-001 Example:**
- Request A checks shift assignment 123 at 10:00:00.100, sees actualClockOut is NULL
- Request B checks shift assignment 123 at 10:00:00.150, sees actualClockOut is NULL
- Both requests execute UPDATE, causing duplicate clock-out records or data corruption
- Expected: Only one request succeeds, the other receives "already clocked out" error

**TENANT-001 Example:**
- Organization A publishes shift for 2024-01-15 09:00-17:00
- Query fetches worker availability without organizationId filter
- Results include availability from Organization B workers
- Expected: Query returns only Organization A worker availability

**GEO-001 Example:**
- Worker attempts clock-in with GPS accuracy = 180 meters
- Worker is actually 150 meters from venue (outside building)
- System accepts location and marks clockInVerified=true
- Expected: System rejects location due to accuracy > 50 meters threshold

**NOTIF-001 Example:**
- Batch contains 100 tokens, 5 are invalid and filtered out
- After chunking, token indices shift but mapping is not maintained
- Error for token at original index 50 is attributed to token at new index 45
- Expected: Each error is correctly attributed to its source token

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Single-request clock-out operations must continue to work without performance degradation
- Shift publishing for non-overlapping shifts must maintain current batch performance
- Same-tenant queries must continue to return correct results with same performance
- Valid geofence operations (accuracy < 50m, radius 10-500m) must work identically
- Single-token notifications must deliver correctly without changes
- Workers with quietHoursEnabled=false must receive all notifications regardless of time

**Scope:**
All inputs that do NOT involve concurrent conflicts, cross-tenant access, invalid geofence data, or problematic notification configurations should be completely unaffected by these fixes. This includes:
- Sequential operations without race conditions
- Properly scoped single-tenant queries
- Valid GPS accuracy and geofence radius values
- Single unique device tokens per worker
- Notifications outside quiet hours or with quiet hours disabled


## Hypothesized Root Cause

Based on the bug descriptions, the root causes are:

### Race Conditions

1. **Check-Then-Act Pattern**: The code uses SELECT queries to check state followed by UPDATE operations without database-level locking or version guards, creating a window for concurrent requests to pass the same checks

2. **Missing Transaction Isolation**: Shift publishing uses default READ COMMITTED isolation instead of SERIALIZABLE, allowing phantom reads where concurrent transactions see the same "no conflicts" state

3. **Non-Atomic Idempotency Checks**: Notification scheduling checks idempotency key and payload hash in separate operations instead of a single atomic check with unique constraints

### Tenant Isolation

4. **Missing Query Filters**: Queries in `publish.ts` and `ingest-location.ts` were written without organizationId filters, likely due to:
   - Copy-paste from single-tenant code
   - Missing code review checklist for multi-tenant queries
   - Lack of query helper functions that enforce tenant scoping

5. **Insufficient Authorization Checks**: The invitation creation endpoint validates token existence but skips the critical check that the inviter is an admin of the target organization

### Geofencing

6. **Missing Validation Thresholds**: The clock-in handler accepts GPS accuracy values without validation, likely because the original implementation didn't consider real-world GPS accuracy variations

7. **Wrong Index Type**: The position column uses a B-Tree index (default for most columns) instead of GIST index optimized for spatial operations, suggesting PostGIS best practices were not followed during schema design

8. **Missing Database Constraints**: The geofenceRadius column lacks CHECK constraints, relying only on application-level validation that can be bypassed

### Notifications

9. **Index-Based Mapping**: The batch notification code uses array indices to map tokens to messages, but filtering and chunking operations shift indices without maintaining explicit mappings

10. **Missing Deduplication Logic**: The notification sender queries all tokens for a worker without deduplication, assuming tokens are unique at the database level (which they may not be)

11. **Server-Centric Time Logic**: The quiet hours check uses JavaScript Date methods that operate in server timezone instead of converting to worker timezone from shift or user preferences


## Correctness Properties

Property 1: Race Condition Prevention - Atomic Clock-Out Operations

_For any_ concurrent clock-out requests targeting the same shift assignment, the fixed system SHALL ensure only one request successfully updates the assignment using database-level concurrency control (optimistic locking with version check or SELECT FOR UPDATE), with subsequent requests receiving a clear "already clocked out" error.

**Validates: Requirements 2.1**

Property 2: Race Condition Prevention - Worker Double-Booking Prevention

_For any_ concurrent shift publishing requests that attempt to assign the same worker to overlapping time ranges, the fixed system SHALL use serializable transaction isolation or unique database constraints to ensure only one assignment succeeds, with conflicting requests receiving a clear conflict error.

**Validates: Requirements 2.2**

Property 3: Race Condition Prevention - Idempotent Notification Scheduling

_For any_ duplicate notification scheduling requests with the same idempotency key, the fixed system SHALL atomically check both key and payload hash within a transaction, returning cached responses for identical requests and rejecting mismatched payloads before creating any notification records.

**Validates: Requirements 2.3**

Property 4: Tenant Isolation - Scoped Availability Queries

_For any_ worker availability query in the shift publishing service, the fixed system SHALL include organizationId filter in the WHERE clause to ensure availability data is scoped to the requesting organization only, preventing cross-tenant data exposure.

**Validates: Requirements 2.4**

Property 5: Tenant Isolation - Scoped Location Queries

_For any_ location ingestion query accessing workerLocation or shiftAssignment tables, the fixed system SHALL consistently filter by organizationId in all queries and joins to prevent cross-tenant data access.

**Validates: Requirements 2.5**

Property 6: Tenant Isolation - Admin-Verified Invitations

_For any_ invitation token creation request, the fixed system SHALL verify that the inviter has an active admin membership in the target organization before creating the invitation, rejecting requests where the inviter is not an admin.

**Validates: Requirements 2.6**

Property 7: Geofencing - GPS Accuracy Validation

_For any_ clock-in request with GPS location data, the fixed system SHALL reject location data with accuracy greater than 50 meters (or configurable threshold) to ensure workers are precisely at the venue location.

**Validates: Requirements 2.7**

Property 8: Geofencing - Optimized Spatial Queries

_For any_ geofence query executing ST_DWithin operations, the fixed system SHALL use GIST indexes on the position column to optimize spatial query performance and prevent timeouts under load.

**Validates: Requirements 2.8**

Property 9: Geofencing - Valid Radius Constraints

_For any_ geofence radius update in the location table, the fixed system SHALL enforce database-level CHECK constraints ensuring geofenceRadius is between 10 and 500 meters, preventing invalid values.

**Validates: Requirements 2.9**

Property 10: Notifications - Reliable Token Mapping

_For any_ batch notification process, the fixed system SHALL maintain an explicit mapping between each message and its source token/notification ID throughout chunking and filtering, ensuring delivery results and errors are attributed to the correct device token.

**Validates: Requirements 2.10**

Property 11: Notifications - Token Deduplication

_For any_ notification sent to a worker with multiple device tokens, the fixed system SHALL deduplicate tokens by pushToken value before sending, ensuring each unique device receives the notification exactly once.

**Validates: Requirements 2.11**

Property 12: Notifications - Timezone-Aware Quiet Hours

_For any_ quiet hours check during notification scheduling, the fixed system SHALL convert the scheduled time to the worker's timezone before comparing against quiet hours start/end times, ensuring quiet hours are respected in the worker's local time.

**Validates: Requirements 2.12**

Property 13: Preservation - Single-Request Operations

_For any_ single clock-out request, shift publishing request, or notification scheduling request without concurrent conflicts, the fixed system SHALL produce the same result as the original system, preserving performance and behavior for non-conflicting operations.

**Validates: Requirements 3.1, 3.2, 3.3**

Property 14: Preservation - Same-Tenant Operations

_For any_ query that correctly filters by organizationId or operates within a single tenant context, the fixed system SHALL produce the same results as the original system, preserving performance and correctness for properly scoped operations.

**Validates: Requirements 3.4, 3.5, 3.6**

Property 15: Preservation - Valid Geofence Operations

_For any_ clock-in with GPS accuracy better than 50 meters, geofence query with proper indexes, or geofence radius within valid range (10-500m), the fixed system SHALL produce the same results as the original system, preserving correct geofence validation behavior.

**Validates: Requirements 3.7, 3.8, 3.9**

Property 16: Preservation - Single-Token Notifications

_For any_ notification sent to a worker with a single unique device token or with quiet hours disabled, the fixed system SHALL produce the same delivery behavior as the original system, preserving correct notification delivery for non-problematic configurations.

**Validates: Requirements 3.10, 3.11, 3.12**


## Fix Implementation

### Category 1: Race Conditions

#### RACE-001: Duplicate Clock-Out Fix

**File**: `src/services/clock-out.ts` (or similar clock-out handler)

**Current Implementation Pattern**:
```typescript
// Vulnerable check-then-act pattern
const assignment = await db.query.shiftAssignment.findFirst({
  where: eq(shiftAssignment.id, assignmentId)
});

if (assignment.actualClockOut !== null) {
  throw new Error("Already clocked out");
}

await db.update(shiftAssignment)
  .set({ actualClockOut: now, status: 'completed' })
  .where(eq(shiftAssignment.id, assignmentId));
```

**Fix Strategy**: Optimistic Locking with WHERE Clause Guard

**Specific Changes**:

1. **Add Version Column** (Optional - for explicit versioning):
   ```sql
   ALTER TABLE shift_assignment ADD COLUMN version INTEGER DEFAULT 1 NOT NULL;
   ```

2. **Implement Atomic Update with Guard**:
   ```typescript
   // Option A: WHERE clause guard (no schema change needed)
   const result = await db.update(shiftAssignment)
     .set({ 
       actualClockOut: now, 
       effectiveClockOut: calculateEffectiveTime(now, scheduledEnd),
       status: 'completed' 
     })
     .where(
       and(
         eq(shiftAssignment.id, assignmentId),
         isNull(shiftAssignment.actualClockOut) // Guard condition
       )
     )
     .returning();

   if (result.length === 0) {
     // Either assignment doesn't exist or already clocked out
     const existing = await db.query.shiftAssignment.findFirst({
       where: eq(shiftAssignment.id, assignmentId)
     });
     
     if (!existing) {
       throw new NotFoundError("Assignment not found");
     }
     throw new ConflictError("Assignment already clocked out");
   }

   // Option B: Explicit version check (requires version column)
   const result = await db.update(shiftAssignment)
     .set({ 
       actualClockOut: now,
       status: 'completed',
       version: sql`${shiftAssignment.version} + 1`
     })
     .where(
       and(
         eq(shiftAssignment.id, assignmentId),
         eq(shiftAssignment.version, currentVersion)
       )
     )
     .returning();
   ```

3. **Add Transaction Wrapper**:
   ```typescript
   await db.transaction(async (tx) => {
     // Perform atomic update
     const result = await tx.update(shiftAssignment)...
     
     // Update related shift status if all assignments complete
     if (result[0].status === 'completed') {
       await checkAndUpdateShiftStatus(tx, result[0].shiftId);
     }
   });
   ```

**Migration Strategy**:
- Option A (WHERE clause guard) requires no migration - can be deployed immediately
- Option B (version column) requires migration but provides explicit versioning for audit trails
- Recommend Option A for immediate fix, Option B for long-term robustness

**Rollback Plan**:
- Revert code changes to previous check-then-act pattern
- If version column added, it can remain (no harm) or be dropped in separate migration


#### RACE-002: Double-Booking Workers Fix

**File**: `src/services/publish.ts` (line 219 and surrounding shift publishing logic)

**Current Implementation Pattern**:
```typescript
// Check for overlaps
const conflicts = await checkWorkerAvailability(workerIds, timeRange);
if (conflicts.length > 0) {
  throw new Error("Workers have conflicts");
}

// Insert assignments (vulnerable window here)
await db.insert(shiftAssignment).values(assignments);
```

**Fix Strategy**: Database Unique Constraint + Serializable Isolation

**Specific Changes**:

1. **Add Database Constraint**:
   ```sql
   -- Create exclusion constraint using btree_gist extension
   CREATE EXTENSION IF NOT EXISTS btree_gist;
   
   -- Add constraint preventing overlapping assignments for same worker
   ALTER TABLE shift_assignment 
   ADD CONSTRAINT no_worker_overlap 
   EXCLUDE USING gist (
     worker_id WITH =,
     tsrange(scheduled_start, scheduled_end) WITH &&
   )
   WHERE (status != 'cancelled');
   ```

2. **Update Application Code to Handle Constraint Violations**:
   ```typescript
   async function publishShifts(shifts: ShiftPublishRequest[], orgId: string) {
     try {
       await db.transaction(async (tx) => {
         // Set serializable isolation for extra safety
         await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`);
         
         // Validate availability (still useful for user feedback)
         const conflicts = await checkWorkerAvailability(tx, workerIds, timeRange, orgId);
         if (conflicts.length > 0) {
           throw new ValidationError("Workers have scheduling conflicts", conflicts);
         }
         
         // Insert assignments - constraint will catch any race conditions
         const result = await tx.insert(shiftAssignment)
           .values(assignments)
           .returning();
           
         return result;
       });
     } catch (error) {
       // Handle constraint violation from concurrent requests
       if (error.code === '23P01') { // exclusion_violation
         throw new ConflictError(
           "Worker scheduling conflict detected. Another request assigned this worker to an overlapping shift.",
           { originalError: error }
         );
       }
       throw error;
     }
   }
   ```

3. **Add Index for Performance**:
   ```sql
   -- Index to speed up conflict checking queries
   CREATE INDEX idx_shift_assignment_worker_time 
   ON shift_assignment USING gist (
     worker_id, 
     tsrange(scheduled_start, scheduled_end)
   )
   WHERE status != 'cancelled';
   ```

**Alternative Approach** (if exclusion constraints are not feasible):
```typescript
// Use SELECT FOR UPDATE to lock worker records during assignment
await db.transaction(async (tx) => {
  // Lock worker records to prevent concurrent assignments
  await tx.select()
    .from(worker)
    .where(inArray(worker.id, workerIds))
    .for('update');
    
  // Now check and insert within locked context
  const conflicts = await checkWorkerAvailability(tx, workerIds, timeRange, orgId);
  if (conflicts.length > 0) {
    throw new ValidationError("Workers have conflicts");
  }
  
  await tx.insert(shiftAssignment).values(assignments);
});
```

**Migration Strategy**:
1. Deploy database migration to add btree_gist extension and exclusion constraint
2. Test constraint with existing data - may reveal existing overlaps that need cleanup
3. Deploy application code changes to handle constraint violations gracefully
4. Monitor for constraint violations in production logs

**Rollback Plan**:
- Drop exclusion constraint: `ALTER TABLE shift_assignment DROP CONSTRAINT no_worker_overlap;`
- Revert application code to previous version
- Constraint can be re-added later without data loss


#### RACE-003: Duplicate Notifications Fix

**File**: `src/services/notification/scheduler.ts` (notification scheduling logic)

**Current Implementation Pattern**:
```typescript
// Check idempotency key
const existing = await db.query.notification.findFirst({
  where: eq(notification.idempotencyKey, key)
});

if (existing) {
  return existing; // Return cached response
}

// Create notification (vulnerable window here)
await db.insert(notification).values({ idempotencyKey: key, ...data });
```

**Fix Strategy**: Unique Constraint + Atomic Insert with Conflict Handling

**Specific Changes**:

1. **Add Unique Constraint and Payload Hash Column**:
   ```sql
   -- Add payload hash column if not exists
   ALTER TABLE notification 
   ADD COLUMN payload_hash VARCHAR(64);
   
   -- Create unique index on idempotency key
   CREATE UNIQUE INDEX idx_notification_idempotency 
   ON notification(idempotency_key) 
   WHERE idempotency_key IS NOT NULL;
   
   -- Optional: Add composite unique constraint for key + hash
   CREATE UNIQUE INDEX idx_notification_idempotency_hash 
   ON notification(idempotency_key, payload_hash) 
   WHERE idempotency_key IS NOT NULL;
   ```

2. **Implement Atomic Insert with ON CONFLICT**:
   ```typescript
   import crypto from 'crypto';
   
   function calculatePayloadHash(payload: NotificationPayload): string {
     return crypto
       .createHash('sha256')
       .update(JSON.stringify(payload))
       .digest('hex');
   }
   
   async function scheduleNotification(
     request: ScheduleNotificationRequest
   ): Promise<Notification> {
     const payloadHash = calculatePayloadHash(request.payload);
     
     try {
       // Attempt insert with conflict detection
       const result = await db.insert(notification)
         .values({
           idempotencyKey: request.idempotencyKey,
           payloadHash: payloadHash,
           workerId: request.workerId,
           payload: request.payload,
           scheduledFor: request.scheduledFor,
           status: 'pending'
         })
         .onConflictDoNothing({ target: notification.idempotencyKey })
         .returning();
       
       if (result.length > 0) {
         // Successfully created new notification
         return result[0];
       }
       
       // Conflict detected - fetch existing and verify hash
       const existing = await db.query.notification.findFirst({
         where: eq(notification.idempotencyKey, request.idempotencyKey)
       });
       
       if (!existing) {
         // Race condition: record was deleted between insert and select
         throw new Error("Notification disappeared during creation");
       }
       
       if (existing.payloadHash !== payloadHash) {
         // Same key, different payload - reject request
         throw new ConflictError(
           `Idempotency key ${request.idempotencyKey} already used with different payload`
         );
       }
       
       // Same key, same payload - return cached response
       return existing;
       
     } catch (error) {
       if (error instanceof ConflictError) {
         throw error;
       }
       // Handle other database errors
       throw new Error(`Failed to schedule notification: ${error.message}`);
     }
   }
   ```

3. **Add Idempotency Key Generation Helper**:
   ```typescript
   // Helper to generate consistent idempotency keys
   function generateIdempotencyKey(
     type: string,
     entityId: string,
     timestamp: Date
   ): string {
     return `${type}:${entityId}:${timestamp.toISOString()}`;
   }
   
   // Usage
   const key = generateIdempotencyKey('shift-reminder', shiftId, scheduledTime);
   ```

**Migration Strategy**:
1. Add payload_hash column (nullable initially)
2. Backfill payload_hash for existing notifications (optional, for audit purposes)
3. Add unique index on idempotency_key
4. Deploy application code changes
5. Monitor for conflict errors indicating duplicate requests

**Rollback Plan**:
- Drop unique index: `DROP INDEX idx_notification_idempotency;`
- Revert application code to previous check-then-insert pattern
- payload_hash column can remain for future use


### Category 2: Tenant Isolation Vulnerabilities

#### TENANT-001: Availability Query Leak Fix

**File**: `src/services/publish.ts` (line 219 and related availability queries)

**Current Implementation Pattern**:
```typescript
// Missing organizationId filter
const availability = await db.query.workerAvailability.findMany({
  where: and(
    inArray(workerAvailability.workerId, workerIds),
    // Missing: eq(workerAvailability.organizationId, orgId)
  )
});
```

**Fix Strategy**: Add organizationId Filter + Query Helper Functions

**Specific Changes**:

1. **Fix Immediate Query**:
   ```typescript
   // In publish.ts around line 219
   async function checkWorkerAvailability(
     tx: Transaction,
     workerIds: string[],
     timeRange: { start: Date; end: Date },
     organizationId: string // Add required parameter
   ) {
     const availability = await tx.query.workerAvailability.findMany({
       where: and(
         eq(workerAvailability.organizationId, organizationId), // ADD THIS
         inArray(workerAvailability.workerId, workerIds),
         or(
           // Time range overlap logic
           and(
             lte(workerAvailability.startTime, timeRange.end),
             gte(workerAvailability.endTime, timeRange.start)
           )
         )
       )
     });
     
     return availability;
   }
   ```

2. **Create Tenant-Scoped Query Helpers**:
   ```typescript
   // src/lib/db/tenant-scoped-queries.ts
   
   /**
    * Helper to ensure all queries include organizationId filter
    */
   export function createTenantScopedQuery<T>(
     organizationId: string,
     baseQuery: (orgId: string) => Promise<T>
   ): Promise<T> {
     if (!organizationId) {
       throw new Error("organizationId is required for tenant-scoped queries");
     }
     return baseQuery(organizationId);
   }
   
   /**
    * Wrapper for worker availability queries
    */
   export async function getWorkerAvailability(
     db: Database,
     organizationId: string,
     workerIds: string[],
     timeRange?: { start: Date; end: Date }
   ) {
     const conditions = [
       eq(workerAvailability.organizationId, organizationId),
       inArray(workerAvailability.workerId, workerIds)
     ];
     
     if (timeRange) {
       conditions.push(
         or(
           and(
             lte(workerAvailability.startTime, timeRange.end),
             gte(workerAvailability.endTime, timeRange.start)
           )
         )
       );
     }
     
     return db.query.workerAvailability.findMany({
       where: and(...conditions)
     });
   }
   ```

3. **Add Linting Rule** (ESLint custom rule):
   ```javascript
   // .eslintrc.js or custom rule
   module.exports = {
     rules: {
       'require-org-filter': {
         create(context) {
           return {
             CallExpression(node) {
               // Detect queries on multi-tenant tables without orgId filter
               if (
                 node.callee.property?.name === 'findMany' &&
                 MULTI_TENANT_TABLES.includes(getTableName(node))
               ) {
                 // Check if organizationId is in where clause
                 if (!hasOrgIdFilter(node)) {
                   context.report({
                     node,
                     message: 'Multi-tenant query must include organizationId filter'
                   });
                 }
               }
             }
           };
         }
       }
     }
   };
   ```

4. **Add Database Row-Level Security** (Defense in Depth):
   ```sql
   -- Enable RLS on worker_availability table
   ALTER TABLE worker_availability ENABLE ROW LEVEL SECURITY;
   
   -- Create policy that requires organization_id match
   CREATE POLICY tenant_isolation_policy ON worker_availability
     USING (organization_id = current_setting('app.current_organization_id')::uuid);
   
   -- Application must set organization context
   -- SET LOCAL app.current_organization_id = '<org-id>';
   ```

**Migration Strategy**:
1. Audit all queries in publish.ts and related files for missing organizationId filters
2. Add organizationId parameter to all affected functions
3. Deploy code changes with comprehensive testing
4. Optionally add RLS policies as defense-in-depth measure
5. Add linting rules to prevent future regressions

**Rollback Plan**:
- Revert code changes to remove organizationId filters
- Disable RLS policies if added: `ALTER TABLE worker_availability DISABLE ROW LEVEL SECURITY;`
- No data migration needed


#### TENANT-002: Location Ingestion Leak Fix

**File**: `src/services/ingest-location.ts` (lines 50-70)

**Current Implementation Pattern**:
```typescript
// Missing or inconsistent organizationId filters
const locations = await db.query.workerLocation.findMany({
  where: eq(workerLocation.workerId, workerId)
  // Missing: eq(workerLocation.organizationId, orgId)
});

const assignments = await db.query.shiftAssignment.findMany({
  where: and(
    eq(shiftAssignment.workerId, workerId),
    eq(shiftAssignment.status, 'active')
  )
  // Missing: join with shift table to filter by organizationId
});
```

**Fix Strategy**: Add Consistent organizationId Filters + Join Corrections

**Specific Changes**:

1. **Fix Worker Location Query**:
   ```typescript
   // In ingest-location.ts around lines 50-70
   async function ingestWorkerLocation(
     locationData: LocationPing,
     organizationId: string // Add required parameter
   ) {
     // Query recent locations with org filter
     const recentLocations = await db.query.workerLocation.findMany({
       where: and(
         eq(workerLocation.workerId, locationData.workerId),
         eq(workerLocation.organizationId, organizationId), // ADD THIS
         gte(workerLocation.timestamp, subHours(new Date(), 1))
       ),
       orderBy: desc(workerLocation.timestamp),
       limit: 10
     });
     
     // Insert new location with org context
     await db.insert(workerLocation).values({
       workerId: locationData.workerId,
       organizationId: organizationId, // Ensure org is set
       position: locationData.position,
       accuracy: locationData.accuracy,
       timestamp: locationData.timestamp
     });
   }
   ```

2. **Fix Shift Assignment Query with Proper Join**:
   ```typescript
   // Query active assignments with organization filter via join
   const activeAssignments = await db
     .select({
       assignment: shiftAssignment,
       shift: shift,
       location: location
     })
     .from(shiftAssignment)
     .innerJoin(shift, eq(shiftAssignment.shiftId, shift.id))
     .innerJoin(location, eq(shift.locationId, location.id))
     .where(
       and(
         eq(shiftAssignment.workerId, locationData.workerId),
         eq(shift.organizationId, organizationId), // ADD THIS via join
         eq(shiftAssignment.status, 'active'),
         isNull(shiftAssignment.actualClockOut)
       )
     );
   ```

3. **Add Middleware to Extract Organization Context**:
   ```typescript
   // src/middleware/tenant-context.ts
   
   export async function extractTenantContext(
     req: Request,
     res: Response,
     next: NextFunction
   ) {
     // Extract from JWT token, API key, or request header
     const token = req.headers.authorization?.replace('Bearer ', '');
     const decoded = verifyToken(token);
     
     // Attach to request context
     req.organizationId = decoded.organizationId;
     req.userId = decoded.userId;
     
     if (!req.organizationId) {
       return res.status(403).json({ error: 'Organization context required' });
     }
     
     next();
   }
   
   // Usage in route
   app.post('/api/location/ingest', 
     extractTenantContext,
     async (req, res) => {
       await ingestWorkerLocation(req.body, req.organizationId);
     }
   );
   ```

4. **Add Query Audit Function**:
   ```typescript
   // Development/testing helper to detect missing org filters
   function auditQuery(query: string, params: any[]): void {
     const multiTenantTables = [
       'worker_location',
       'shift_assignment',
       'worker_availability',
       'shift'
     ];
     
     for (const table of multiTenantTables) {
       if (query.includes(table) && !query.includes('organization_id')) {
         console.warn(
           `⚠️  Query on ${table} missing organization_id filter`,
           { query, params }
         );
       }
     }
   }
   ```

**Migration Strategy**:
1. Audit all location ingestion queries for missing organizationId filters
2. Update function signatures to require organizationId parameter
3. Add middleware to extract organization context from requests
4. Deploy with comprehensive integration tests
5. Monitor logs for any remaining unscoped queries

**Rollback Plan**:
- Revert code changes to remove organizationId filters and joins
- Remove tenant context middleware
- No database changes required


#### TENANT-003: Invitation Token Bypass Fix

**File**: `src/services/auth.ts` (lines 160-180)

**Current Implementation Pattern**:
```typescript
// Missing admin verification
async function createInvitation(
  inviterId: string,
  organizationId: string,
  email: string
) {
  // Only checks if token exists, not if inviter is admin
  const token = generateToken();
  
  await db.insert(invitation).values({
    token,
    inviterId,
    organizationId,
    email,
    expiresAt: addDays(new Date(), 7)
  });
  
  return token;
}
```

**Fix Strategy**: Add Admin Authorization Check

**Specific Changes**:

1. **Add Admin Verification**:
   ```typescript
   // In auth.ts around lines 160-180
   async function createInvitation(
     inviterId: string,
     organizationId: string,
     email: string,
     role: 'worker' | 'admin' = 'worker'
   ) {
     // CRITICAL: Verify inviter is an admin of the target organization
     const inviterMembership = await db.query.organizationMembership.findFirst({
       where: and(
         eq(organizationMembership.userId, inviterId),
         eq(organizationMembership.organizationId, organizationId),
         eq(organizationMembership.role, 'admin'),
         eq(organizationMembership.status, 'active')
       )
     });
     
     if (!inviterMembership) {
       throw new ForbiddenError(
         'Only active admins can create invitations for this organization'
       );
     }
     
     // Check if invitation already exists for this email
     const existingInvitation = await db.query.invitation.findFirst({
       where: and(
         eq(invitation.organizationId, organizationId),
         eq(invitation.email, email),
         eq(invitation.status, 'pending'),
         gte(invitation.expiresAt, new Date())
       )
     });
     
     if (existingInvitation) {
       // Return existing invitation instead of creating duplicate
       return existingInvitation;
     }
     
     // Generate secure token
     const token = crypto.randomBytes(32).toString('hex');
     
     // Create invitation
     const [newInvitation] = await db.insert(invitation)
       .values({
         token,
         inviterId,
         organizationId,
         email,
         role,
         status: 'pending',
         expiresAt: addDays(new Date(), 7),
         createdAt: new Date()
       })
       .returning();
     
     return newInvitation;
   }
   ```

2. **Add Authorization Middleware**:
   ```typescript
   // src/middleware/authorization.ts
   
   export function requireOrgAdmin(
     req: Request,
     res: Response,
     next: NextFunction
   ) {
     const { organizationId } = req.params;
     const { userId } = req.user; // From auth middleware
     
     // Verify admin status
     const membership = await db.query.organizationMembership.findFirst({
       where: and(
         eq(organizationMembership.userId, userId),
         eq(organizationMembership.organizationId, organizationId),
         eq(organizationMembership.role, 'admin'),
         eq(organizationMembership.status, 'active')
       )
     });
     
     if (!membership) {
       return res.status(403).json({ 
         error: 'Admin access required for this organization' 
       });
     }
     
     req.membership = membership;
     next();
   }
   
   // Usage
   app.post('/api/organizations/:organizationId/invitations',
     authenticate,
     requireOrgAdmin,
     async (req, res) => {
       const invitation = await createInvitation(
         req.user.userId,
         req.params.organizationId,
         req.body.email,
         req.body.role
       );
       res.json(invitation);
     }
   );
   ```

3. **Add Invitation Acceptance Validation**:
   ```typescript
   async function acceptInvitation(token: string, userId: string) {
     const invitation = await db.query.invitation.findFirst({
       where: and(
         eq(invitation.token, token),
         eq(invitation.status, 'pending'),
         gte(invitation.expiresAt, new Date())
       ),
       with: {
         organization: true,
         inviter: true
       }
     });
     
     if (!invitation) {
       throw new NotFoundError('Invalid or expired invitation');
     }
     
     // Verify inviter is still an admin (defense in depth)
     const inviterStillAdmin = await db.query.organizationMembership.findFirst({
       where: and(
         eq(organizationMembership.userId, invitation.inviterId),
         eq(organizationMembership.organizationId, invitation.organizationId),
         eq(organizationMembership.role, 'admin'),
         eq(organizationMembership.status, 'active')
       )
     });
     
     if (!inviterStillAdmin) {
       throw new ForbiddenError(
         'Invitation is no longer valid - inviter is not an active admin'
       );
     }
     
     // Create membership
     await db.transaction(async (tx) => {
       await tx.insert(organizationMembership).values({
         userId,
         organizationId: invitation.organizationId,
         role: invitation.role,
         status: 'active',
         joinedAt: new Date()
       });
       
       await tx.update(invitation)
         .set({ status: 'accepted', acceptedAt: new Date() })
         .where(eq(invitation.id, invitation.id));
     });
   }
   ```

**Migration Strategy**:
1. Deploy admin verification code changes
2. Add authorization middleware to invitation endpoints
3. Audit existing invitations for any created by non-admins (optional cleanup)
4. Add integration tests for authorization checks
5. Monitor for authorization errors in logs

**Rollback Plan**:
- Revert code changes to remove admin verification
- Remove authorization middleware
- No database changes required


### Category 3: Geofencing Issues

#### GEO-001: Excessive GPS Accuracy Fix

**File**: `src/services/clock-in.ts` (lines 35-40)

**Current Implementation Pattern**:
```typescript
// No accuracy validation
async function clockIn(
  assignmentId: string,
  location: { lat: number; lng: number; accuracy: number }
) {
  // Accepts any accuracy value, even 200+ meters
  const isWithinGeofence = await checkGeofence(location, assignmentId);
  
  await db.update(shiftAssignment).set({
    actualClockIn: new Date(),
    clockInVerified: isWithinGeofence
  });
}
```

**Fix Strategy**: Add GPS Accuracy Validation with Configurable Threshold

**Specific Changes**:

1. **Add Configuration Table/Constants**:
   ```typescript
   // src/config/geofence.ts
   export const GEOFENCE_CONFIG = {
     MAX_GPS_ACCURACY_METERS: 50, // Reject if accuracy > 50m
     RECOMMENDED_ACCURACY_METERS: 30, // Warn if accuracy > 30m
     MIN_GEOFENCE_RADIUS_METERS: 10,
     MAX_GEOFENCE_RADIUS_METERS: 500
   };
   
   // Optional: Store in database for per-organization configuration
   // ALTER TABLE organization ADD COLUMN max_gps_accuracy INTEGER DEFAULT 50;
   ```

2. **Add Accuracy Validation**:
   ```typescript
   // In clock-in.ts around lines 35-40
   async function clockIn(
     assignmentId: string,
     location: { lat: number; lng: number; accuracy: number },
     organizationId: string
   ) {
     // Validate GPS accuracy
     if (location.accuracy > GEOFENCE_CONFIG.MAX_GPS_ACCURACY_METERS) {
       throw new ValidationError(
         `GPS accuracy too low: ${location.accuracy}m. ` +
         `Please wait for better GPS signal (required: <${GEOFENCE_CONFIG.MAX_GPS_ACCURACY_METERS}m)`
       );
     }
     
     // Warn if accuracy is suboptimal but acceptable
     const accuracyWarning = location.accuracy > GEOFENCE_CONFIG.RECOMMENDED_ACCURACY_METERS
       ? `GPS accuracy is ${location.accuracy}m (recommended: <${GEOFENCE_CONFIG.RECOMMENDED_ACCURACY_METERS}m)`
       : null;
     
     // Fetch assignment with location details
     const assignment = await db.query.shiftAssignment.findFirst({
       where: eq(shiftAssignment.id, assignmentId),
       with: {
         shift: {
           with: {
             location: true
           }
         }
       }
     });
     
     if (!assignment) {
       throw new NotFoundError('Shift assignment not found');
     }
     
     // Verify organization context
     if (assignment.shift.organizationId !== organizationId) {
       throw new ForbiddenError('Assignment belongs to different organization');
     }
     
     // Check geofence with validated location
     const geofenceResult = await checkGeofence(
       location,
       assignment.shift.location
     );
     
     // Record clock-in with accuracy metadata
     await db.update(shiftAssignment)
       .set({
         actualClockIn: new Date(),
         clockInVerified: geofenceResult.isWithin,
         clockInAccuracy: location.accuracy,
         clockInDistance: geofenceResult.distance,
         clockInWarning: accuracyWarning
       })
       .where(eq(shiftAssignment.id, assignmentId));
     
     return {
       success: true,
       verified: geofenceResult.isWithin,
       distance: geofenceResult.distance,
       accuracy: location.accuracy,
       warning: accuracyWarning
     };
   }
   ```

3. **Add Schema Changes for Metadata**:
   ```sql
   -- Add columns to track GPS accuracy and distance
   ALTER TABLE shift_assignment 
   ADD COLUMN clock_in_accuracy DECIMAL(10, 2),
   ADD COLUMN clock_in_distance DECIMAL(10, 2),
   ADD COLUMN clock_in_warning TEXT,
   ADD COLUMN clock_out_accuracy DECIMAL(10, 2),
   ADD COLUMN clock_out_distance DECIMAL(10, 2);
   
   -- Add index for querying low-accuracy clock-ins
   CREATE INDEX idx_shift_assignment_accuracy 
   ON shift_assignment(clock_in_accuracy) 
   WHERE clock_in_accuracy > 30;
   ```

4. **Add Client-Side Guidance**:
   ```typescript
   // Mobile app helper
   export async function getLocationForClockIn(): Promise<LocationData> {
     const location = await getCurrentPosition({
       enableHighAccuracy: true,
       timeout: 10000,
       maximumAge: 0
     });
     
     if (location.coords.accuracy > 50) {
       throw new Error(
         'GPS signal too weak. Please move to an area with better signal and try again.'
       );
     }
     
     return {
       lat: location.coords.latitude,
       lng: location.coords.longitude,
       accuracy: location.coords.accuracy
     };
   }
   ```

**Migration Strategy**:
1. Add configuration constants or database columns
2. Add accuracy validation to clock-in handler
3. Add schema columns for accuracy metadata (optional but recommended)
4. Update mobile app to request high-accuracy GPS
5. Monitor accuracy distribution in production logs

**Rollback Plan**:
- Revert code changes to remove accuracy validation
- Accuracy metadata columns can remain (no harm) or be dropped
- Update mobile app to remove high-accuracy requirement


#### GEO-002: Missing Spatial Index Fix

**File**: `src/services/clock-in.ts` (lines 60-75) and database schema

**Current Implementation Pattern**:
```typescript
// Query uses ST_DWithin but position column has B-Tree index
const isWithin = await db.execute(sql`
  SELECT ST_DWithin(
    position,
    ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
    ${radius}
  ) as is_within
  FROM location
  WHERE id = ${locationId}
`);
```

**Fix Strategy**: Add GIST Index for Spatial Queries

**Specific Changes**:

1. **Add PostGIS Extension and GIST Index**:
   ```sql
   -- Ensure PostGIS is installed
   CREATE EXTENSION IF NOT EXISTS postgis;
   
   -- Drop existing B-Tree index if it exists
   DROP INDEX IF EXISTS idx_location_position;
   
   -- Create GIST index optimized for spatial queries
   CREATE INDEX idx_location_position_gist 
   ON location USING gist(position);
   
   -- Optional: Add index on organization_id for combined queries
   CREATE INDEX idx_location_org_position 
   ON location USING gist(organization_id, position);
   ```

2. **Verify Index Usage**:
   ```typescript
   // Add query plan analysis in development
   async function checkGeofence(
     location: { lat: number; lng: number },
     venueLocation: Location
   ): Promise<{ isWithin: boolean; distance: number }> {
     // In development, log query plan
     if (process.env.NODE_ENV === 'development') {
       const plan = await db.execute(sql`
         EXPLAIN ANALYZE
         SELECT 
           ST_DWithin(
             position,
             ST_SetSRID(ST_MakePoint(${location.lng}, ${location.lat}), 4326)::geography,
             ${venueLocation.geofenceRadius}
           ) as is_within,
           ST_Distance(
             position,
             ST_SetSRID(ST_MakePoint(${location.lng}, ${location.lat}), 4326)::geography
           ) as distance
         FROM location
         WHERE id = ${venueLocation.id}
       `);
       console.log('Geofence query plan:', plan);
     }
     
     // Execute actual query
     const result = await db.execute(sql`
       SELECT 
         ST_DWithin(
           position::geography,
           ST_SetSRID(ST_MakePoint(${location.lng}, ${location.lat}), 4326)::geography,
           ${venueLocation.geofenceRadius}
         ) as is_within,
         ST_Distance(
           position::geography,
           ST_SetSRID(ST_MakePoint(${location.lng}, ${location.lat}), 4326)::geography
         ) as distance
       FROM location
       WHERE id = ${venueLocation.id}
     `);
     
     return {
       isWithin: result.rows[0].is_within,
       distance: parseFloat(result.rows[0].distance)
     };
   }
   ```

3. **Optimize Position Column Type** (Optional but recommended):
   ```sql
   -- Consider using geography type instead of geometry for better accuracy
   -- This requires data migration
   
   -- Add new column
   ALTER TABLE location ADD COLUMN position_geography geography(Point, 4326);
   
   -- Migrate data
   UPDATE location SET position_geography = position::geography;
   
   -- Create index on new column
   CREATE INDEX idx_location_position_geography 
   ON location USING gist(position_geography);
   
   -- After verification, drop old column
   -- ALTER TABLE location DROP COLUMN position;
   -- ALTER TABLE location RENAME COLUMN position_geography TO position;
   ```

4. **Add Performance Monitoring**:
   ```typescript
   // src/lib/monitoring/geofence-metrics.ts
   
   export async function monitorGeofencePerformance(
     operation: () => Promise<any>
   ): Promise<any> {
     const start = performance.now();
     
     try {
       const result = await operation();
       const duration = performance.now() - start;
       
       // Log slow queries
       if (duration > 100) { // 100ms threshold
         console.warn('Slow geofence query detected', {
           duration,
           threshold: 100
         });
       }
       
       // Send to metrics service
       metrics.histogram('geofence.query.duration', duration);
       
       return result;
     } catch (error) {
       metrics.increment('geofence.query.error');
       throw error;
     }
   }
   
   // Usage
   const result = await monitorGeofencePerformance(() =>
     checkGeofence(location, venueLocation)
   );
   ```

**Migration Strategy**:
1. Create PostGIS extension if not exists (requires superuser or rds_superuser)
2. Create GIST index on position column (can be done online in PostgreSQL 11+)
3. Monitor query performance before and after index creation
4. Optionally migrate to geography type for better accuracy
5. Add performance monitoring to detect regressions

**Rollback Plan**:
- Drop GIST index: `DROP INDEX idx_location_position_gist;`
- Recreate B-Tree index if needed: `CREATE INDEX idx_location_position ON location(position);`
- Revert geography column migration if performed
- No application code changes needed for rollback

**Performance Impact**:
- Index creation may take several minutes on large tables (use CONCURRENTLY option)
- Query performance should improve by 10-100x for spatial operations
- Index size will be larger than B-Tree but provides significant query speedup


#### GEO-003: Invalid Geofence Radius Fix

**File**: Database schema for `location` table

**Current Implementation Pattern**:
```sql
-- No constraints on geofence_radius
CREATE TABLE location (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  position GEOMETRY(Point, 4326),
  geofence_radius INTEGER, -- No min/max constraints
  organization_id UUID REFERENCES organization(id)
);
```

**Fix Strategy**: Add CHECK Constraint + Application Validation

**Specific Changes**:

1. **Add Database CHECK Constraint**:
   ```sql
   -- Add constraint to enforce valid radius range
   ALTER TABLE location 
   ADD CONSTRAINT check_geofence_radius_range 
   CHECK (geofence_radius >= 10 AND geofence_radius <= 500);
   
   -- Optional: Add constraint for non-null values
   ALTER TABLE location 
   ALTER COLUMN geofence_radius SET NOT NULL,
   ALTER COLUMN geofence_radius SET DEFAULT 100;
   ```

2. **Handle Existing Invalid Data**:
   ```sql
   -- Identify invalid data before adding constraint
   SELECT id, name, geofence_radius 
   FROM location 
   WHERE geofence_radius < 10 OR geofence_radius > 500 OR geofence_radius IS NULL;
   
   -- Fix invalid data (adjust to reasonable defaults)
   UPDATE location 
   SET geofence_radius = CASE
     WHEN geofence_radius IS NULL THEN 100
     WHEN geofence_radius < 10 THEN 10
     WHEN geofence_radius > 500 THEN 500
     ELSE geofence_radius
   END
   WHERE geofence_radius < 10 OR geofence_radius > 500 OR geofence_radius IS NULL;
   ```

3. **Add Application-Level Validation**:
   ```typescript
   // src/lib/validation/geofence.ts
   
   import { z } from 'zod';
   
   export const GeofenceRadiusSchema = z.number()
     .int('Geofence radius must be an integer')
     .min(10, 'Geofence radius must be at least 10 meters')
     .max(500, 'Geofence radius must not exceed 500 meters');
   
   export const LocationSchema = z.object({
     name: z.string().min(1).max(255),
     latitude: z.number().min(-90).max(90),
     longitude: z.number().min(-180).max(180),
     geofenceRadius: GeofenceRadiusSchema,
     organizationId: z.string().uuid()
   });
   
   // Usage in API handler
   async function createLocation(data: unknown) {
     // Validate input
     const validated = LocationSchema.parse(data);
     
     // Create location
     const location = await db.insert(location).values({
       name: validated.name,
       position: sql`ST_SetSRID(ST_MakePoint(${validated.longitude}, ${validated.latitude}), 4326)`,
       geofenceRadius: validated.geofenceRadius,
       organizationId: validated.organizationId
     }).returning();
     
     return location[0];
   }
   
   async function updateLocation(id: string, data: Partial<LocationUpdate>) {
     // Validate geofence radius if provided
     if (data.geofenceRadius !== undefined) {
       GeofenceRadiusSchema.parse(data.geofenceRadius);
     }
     
     const updated = await db.update(location)
       .set(data)
       .where(eq(location.id, id))
       .returning();
     
     return updated[0];
   }
   ```

4. **Add User-Friendly Error Handling**:
   ```typescript
   // src/middleware/error-handler.ts
   
   export function handleDatabaseError(error: any): ApiError {
     // Handle CHECK constraint violation
     if (error.code === '23514') { // check_violation
       if (error.constraint === 'check_geofence_radius_range') {
         return new ValidationError(
           'Geofence radius must be between 10 and 500 meters',
           { field: 'geofenceRadius', min: 10, max: 500 }
         );
       }
     }
     
     // Handle other errors
     return new InternalServerError('Database operation failed');
   }
   ```

5. **Add Admin UI Guidance**:
   ```typescript
   // Frontend validation and guidance
   export const GeofenceRadiusInput = () => {
     return (
       <div>
         <label>Geofence Radius (meters)</label>
         <input
           type="number"
           min={10}
           max={500}
           step={10}
           defaultValue={100}
         />
         <p className="help-text">
           Recommended: 50-150 meters for most venues.
           Smaller radius = more precise location verification.
           Larger radius = more flexibility for GPS accuracy.
         </p>
       </div>
     );
   };
   ```

**Migration Strategy**:
1. Identify and fix existing invalid geofence radius values
2. Add CHECK constraint to database
3. Add application-level validation with Zod schemas
4. Update admin UI with validation and guidance
5. Test constraint with various invalid inputs
6. Monitor for constraint violations in production logs

**Rollback Plan**:
- Drop CHECK constraint: `ALTER TABLE location DROP CONSTRAINT check_geofence_radius_range;`
- Revert application validation code
- No data loss - constraint only prevents future invalid values

**Data Cleanup Script**:
```typescript
// scripts/fix-invalid-geofence-radius.ts

async function fixInvalidGeofenceRadius() {
  const invalid = await db.query.location.findMany({
    where: or(
      lt(location.geofenceRadius, 10),
      gt(location.geofenceRadius, 500),
      isNull(location.geofenceRadius)
    )
  });
  
  console.log(`Found ${invalid.length} locations with invalid geofence radius`);
  
  for (const loc of invalid) {
    const newRadius = loc.geofenceRadius === null ? 100
      : loc.geofenceRadius < 10 ? 10
      : loc.geofenceRadius > 500 ? 500
      : loc.geofenceRadius;
    
    await db.update(location)
      .set({ geofenceRadius: newRadius })
      .where(eq(location.id, loc.id));
    
    console.log(`Fixed location ${loc.id}: ${loc.geofenceRadius} -> ${newRadius}`);
  }
  
  console.log('Cleanup complete');
}
```


### Category 4: Notification System Issues

#### NOTIF-001: Token Mapping Loss Fix

**File**: `src/services/notification/expo-push.ts` (lines 70-80)

**Current Implementation Pattern**:
```typescript
// Token-to-message mapping lost during filtering and chunking
async function sendBatchNotifications(notifications: Notification[]) {
  const tokens = notifications.map(n => n.pushToken);
  
  // Filter invalid tokens (indices shift here)
  const validTokens = tokens.filter(t => isValidExpoPushToken(t));
  
  // Chunk messages (indices shift again)
  const chunks = chunkArray(validTokens, 100);
  
  for (const chunk of chunks) {
    const tickets = await expo.sendPushNotificationsAsync(chunk);
    
    // ERROR: tickets[i] may not correspond to original notifications[i]
    tickets.forEach((ticket, i) => {
      if (ticket.status === 'error') {
        markTokenInactive(tokens[i]); // Wrong token!
      }
    });
  }
}
```

**Fix Strategy**: Maintain Explicit Token-to-Notification Mapping

**Specific Changes**:

1. **Create Mapping Structure**:
   ```typescript
   // src/services/notification/expo-push.ts
   
   interface NotificationWithToken {
     notificationId: string;
     pushToken: string;
     message: ExpoPushMessage;
     originalIndex: number;
   }
   
   interface SendResult {
     notificationId: string;
     pushToken: string;
     status: 'success' | 'error';
     ticketId?: string;
     error?: string;
   }
   ```

2. **Implement Mapping-Preserving Send Logic**:
   ```typescript
   async function sendBatchNotifications(
     notifications: Notification[]
   ): Promise<SendResult[]> {
     // Create explicit mapping
     const notificationsWithTokens: NotificationWithToken[] = notifications
       .map((notification, index) => ({
         notificationId: notification.id,
         pushToken: notification.pushToken,
         message: {
           to: notification.pushToken,
           title: notification.title,
           body: notification.body,
           data: notification.data
         },
         originalIndex: index
       }))
       .filter(item => {
         // Filter invalid tokens but keep mapping
         const isValid = isValidExpoPushToken(item.pushToken);
         if (!isValid) {
           console.warn(`Invalid push token for notification ${item.notificationId}`);
         }
         return isValid;
       });
     
     // Chunk while preserving mapping
     const chunks = chunkArray(notificationsWithTokens, 100);
     const results: SendResult[] = [];
     
     for (const chunk of chunks) {
       try {
         // Send chunk
         const messages = chunk.map(item => item.message);
         const tickets = await expo.sendPushNotificationsAsync(messages);
         
         // Map results back to original notifications
         tickets.forEach((ticket, chunkIndex) => {
           const item = chunk[chunkIndex]; // Correct mapping preserved
           
           if (ticket.status === 'ok') {
             results.push({
               notificationId: item.notificationId,
               pushToken: item.pushToken,
               status: 'success',
               ticketId: ticket.id
             });
           } else {
             results.push({
               notificationId: item.notificationId,
               pushToken: item.pushToken,
               status: 'error',
               error: ticket.message
             });
             
             // Mark correct token as inactive
             await markTokenInactive(item.pushToken, ticket.message);
           }
         });
       } catch (error) {
         // Handle chunk-level errors
         console.error('Failed to send notification chunk', error);
         
         // Mark all notifications in chunk as failed
         chunk.forEach(item => {
           results.push({
             notificationId: item.notificationId,
             pushToken: item.pushToken,
             status: 'error',
             error: error.message
           });
         });
       }
     }
     
     // Update notification statuses in database
     await updateNotificationStatuses(results);
     
     return results;
   }
   ```

3. **Add Token Status Tracking**:
   ```typescript
   async function markTokenInactive(
     pushToken: string,
     reason: string
   ): Promise<void> {
     // Find all device tokens with this push token
     const devices = await db.query.deviceToken.findMany({
       where: eq(deviceToken.pushToken, pushToken)
     });
     
     if (devices.length === 0) {
       console.warn(`No device found for push token: ${pushToken}`);
       return;
     }
     
     // Mark as inactive with reason
     await db.update(deviceToken)
       .set({
         status: 'inactive',
         inactiveReason: reason,
         inactiveAt: new Date()
       })
       .where(eq(deviceToken.pushToken, pushToken));
     
     console.log(`Marked ${devices.length} device(s) inactive for token ${pushToken}: ${reason}`);
   }
   
   async function updateNotificationStatuses(
     results: SendResult[]
   ): Promise<void> {
     // Batch update notification statuses
     const updates = results.map(result => ({
       id: result.notificationId,
       status: result.status === 'success' ? 'sent' : 'failed',
       sentAt: result.status === 'success' ? new Date() : null,
       errorMessage: result.error,
       ticketId: result.ticketId
     }));
     
     // Use transaction for atomic updates
     await db.transaction(async (tx) => {
       for (const update of updates) {
         await tx.update(notification)
           .set({
             status: update.status,
             sentAt: update.sentAt,
             errorMessage: update.errorMessage,
             ticketId: update.ticketId
           })
           .where(eq(notification.id, update.id));
       }
     });
   }
   ```

4. **Add Comprehensive Logging**:
   ```typescript
   // src/lib/logging/notification-logger.ts
   
   export function logNotificationBatch(
     notifications: NotificationWithToken[],
     results: SendResult[]
   ): void {
     const summary = {
       total: notifications.length,
       sent: results.filter(r => r.status === 'success').length,
       failed: results.filter(r => r.status === 'error').length,
       errors: results
         .filter(r => r.status === 'error')
         .map(r => ({
           notificationId: r.notificationId,
           pushToken: r.pushToken.substring(0, 20) + '...', // Truncate for privacy
           error: r.error
         }))
     };
     
     console.log('Notification batch results:', summary);
     
     // Send to monitoring service
     metrics.gauge('notifications.batch.total', summary.total);
     metrics.gauge('notifications.batch.sent', summary.sent);
     metrics.gauge('notifications.batch.failed', summary.failed);
   }
   ```

**Migration Strategy**:
1. Deploy new mapping-preserving send logic
2. Add comprehensive logging to verify correct attribution
3. Monitor for token status changes to ensure correct tokens are marked inactive
4. Add alerts for high error rates
5. Gradually increase batch sizes while monitoring

**Rollback Plan**:
- Revert to previous send logic
- No database changes required
- Token status updates may need manual review if incorrect attributions occurred


#### NOTIF-002: Duplicate Token Notifications Fix

**File**: `src/services/notification/expo-push.ts` and token query logic

**Current Implementation Pattern**:
```typescript
// No deduplication - sends to all tokens
async function sendNotificationToWorker(workerId: string, message: NotificationMessage) {
  const tokens = await db.query.deviceToken.findMany({
    where: and(
      eq(deviceToken.workerId, workerId),
      eq(deviceToken.status, 'active')
    )
  });
  
  // May contain duplicate pushToken values
  for (const token of tokens) {
    await sendPushNotification(token.pushToken, message);
  }
}
```

**Fix Strategy**: Deduplicate Tokens Before Sending

**Specific Changes**:

1. **Add Token Deduplication Logic**:
   ```typescript
   async function sendNotificationToWorker(
     workerId: string,
     message: NotificationMessage,
     organizationId: string
   ): Promise<SendResult[]> {
     // Query all active tokens for worker
     const tokens = await db.query.deviceToken.findMany({
       where: and(
         eq(deviceToken.workerId, workerId),
         eq(deviceToken.organizationId, organizationId),
         eq(deviceToken.status, 'active')
       ),
       orderBy: desc(deviceToken.lastUsedAt) // Prefer recently used tokens
     });
     
     // Deduplicate by pushToken value
     const uniqueTokens = deduplicateTokens(tokens);
     
     console.log(
       `Worker ${workerId}: ${tokens.length} total tokens, ` +
       `${uniqueTokens.length} unique tokens after deduplication`
     );
     
     // Send to unique tokens only
     const results = await sendBatchNotifications(
       uniqueTokens.map(token => ({
         id: generateNotificationId(),
         pushToken: token.pushToken,
         workerId: workerId,
         title: message.title,
         body: message.body,
         data: message.data
       }))
     );
     
     return results;
   }
   
   function deduplicateTokens(tokens: DeviceToken[]): DeviceToken[] {
     const seen = new Map<string, DeviceToken>();
     
     for (const token of tokens) {
       const existing = seen.get(token.pushToken);
       
       if (!existing) {
         // First occurrence - keep it
         seen.set(token.pushToken, token);
       } else {
         // Duplicate found - keep the more recently used one
         if (token.lastUsedAt > existing.lastUsedAt) {
           seen.set(token.pushToken, token);
         }
         
         console.log(
           `Duplicate token detected: ${token.pushToken.substring(0, 20)}... ` +
           `(keeping ${token.lastUsedAt > existing.lastUsedAt ? 'newer' : 'older'})`
         );
       }
     }
     
     return Array.from(seen.values());
   }
   ```

2. **Add Database Unique Constraint** (Optional - prevents duplicates at source):
   ```sql
   -- Add unique constraint on worker_id + push_token
   -- This prevents duplicate registrations at the database level
   CREATE UNIQUE INDEX idx_device_token_worker_push 
   ON device_token(worker_id, push_token) 
   WHERE status = 'active';
   ```

3. **Update Token Registration Logic**:
   ```typescript
   async function registerDeviceToken(
     workerId: string,
     pushToken: string,
     deviceInfo: DeviceInfo,
     organizationId: string
   ): Promise<DeviceToken> {
     // Check for existing token
     const existing = await db.query.deviceToken.findFirst({
       where: and(
         eq(deviceToken.workerId, workerId),
         eq(deviceToken.pushToken, pushToken),
         eq(deviceToken.organizationId, organizationId)
       )
     });
     
     if (existing) {
       // Update existing token instead of creating duplicate
       const updated = await db.update(deviceToken)
         .set({
           status: 'active',
           lastUsedAt: new Date(),
           deviceInfo: deviceInfo
         })
         .where(eq(deviceToken.id, existing.id))
         .returning();
       
       console.log(`Updated existing device token for worker ${workerId}`);
       return updated[0];
     }
     
     // Create new token
     try {
       const newToken = await db.insert(deviceToken)
         .values({
           workerId,
           pushToken,
           organizationId,
           deviceInfo,
           status: 'active',
           registeredAt: new Date(),
           lastUsedAt: new Date()
         })
         .returning();
       
       console.log(`Registered new device token for worker ${workerId}`);
       return newToken[0];
       
     } catch (error) {
       // Handle unique constraint violation
       if (error.code === '23505') { // unique_violation
         console.log(`Token already registered, fetching existing`);
         return await db.query.deviceToken.findFirst({
           where: and(
             eq(deviceToken.workerId, workerId),
             eq(deviceToken.pushToken, pushToken)
           )
         });
       }
       throw error;
     }
   }
   ```

4. **Add Token Cleanup Job**:
   ```typescript
   // scripts/cleanup-duplicate-tokens.ts
   
   async function cleanupDuplicateTokens(): Promise<void> {
     console.log('Starting duplicate token cleanup...');
     
     // Find workers with duplicate tokens
     const duplicates = await db.execute(sql`
       SELECT worker_id, push_token, COUNT(*) as count
       FROM device_token
       WHERE status = 'active'
       GROUP BY worker_id, push_token
       HAVING COUNT(*) > 1
     `);
     
     console.log(`Found ${duplicates.rows.length} duplicate token groups`);
     
     for (const dup of duplicates.rows) {
       // Get all tokens for this worker+pushToken combination
       const tokens = await db.query.deviceToken.findMany({
         where: and(
           eq(deviceToken.workerId, dup.worker_id),
           eq(deviceToken.pushToken, dup.push_token),
           eq(deviceToken.status, 'active')
         ),
         orderBy: desc(deviceToken.lastUsedAt)
       });
       
       // Keep the most recently used, deactivate others
       const [keep, ...deactivate] = tokens;
       
       for (const token of deactivate) {
         await db.update(deviceToken)
           .set({
             status: 'inactive',
             inactiveReason: 'Duplicate token - kept most recent',
             inactiveAt: new Date()
           })
           .where(eq(deviceToken.id, token.id));
       }
       
       console.log(
         `Worker ${dup.worker_id}: kept 1 token, deactivated ${deactivate.length}`
       );
     }
     
     console.log('Cleanup complete');
   }
   
   // Run as cron job or one-time migration
   if (require.main === module) {
     cleanupDuplicateTokens()
       .then(() => process.exit(0))
       .catch(error => {
         console.error('Cleanup failed:', error);
         process.exit(1);
       });
   }
   ```

**Migration Strategy**:
1. Run cleanup script to identify and deactivate existing duplicate tokens
2. Deploy deduplication logic in notification sending
3. Update token registration to use upsert pattern
4. Optionally add unique constraint to prevent future duplicates
5. Monitor notification delivery rates to ensure no regressions

**Rollback Plan**:
- Revert deduplication logic (will resume sending duplicates)
- Drop unique constraint if added
- Reactivate tokens that were deactivated by cleanup script (if needed)


#### NOTIF-004: Timezone-Unaware Quiet Hours Fix

**File**: `src/services/notification/scheduler.ts` (lines 180-200)

**Current Implementation Pattern**:
```typescript
// Uses server time without timezone conversion
function shouldSendNotification(
  notification: Notification,
  worker: Worker
): boolean {
  if (!worker.quietHoursEnabled) {
    return true;
  }
  
  const now = new Date(); // Server time!
  const hour = now.getHours();
  
  // Compares server hour against worker's quiet hours
  if (hour >= worker.quietHoursStart && hour < worker.quietHoursEnd) {
    return false; // In quiet hours
  }
  
  return true;
}
```

**Fix Strategy**: Convert to Worker Timezone Before Comparison

**Specific Changes**:

1. **Add Timezone Support to Schema**:
   ```sql
   -- Add timezone column to worker table if not exists
   ALTER TABLE worker 
   ADD COLUMN timezone VARCHAR(50) DEFAULT 'UTC';
   
   -- Add timezone to shift table for shift-specific timezone
   ALTER TABLE shift 
   ADD COLUMN timezone VARCHAR(50);
   
   -- Create index for timezone queries
   CREATE INDEX idx_worker_timezone ON worker(timezone);
   ```

2. **Install Timezone Library**:
   ```bash
   npm install date-fns-tz
   # or
   npm install luxon
   ```

3. **Implement Timezone-Aware Quiet Hours Check**:
   ```typescript
   import { utcToZonedTime, format } from 'date-fns-tz';
   
   interface QuietHoursConfig {
     enabled: boolean;
     startHour: number; // 0-23
     endHour: number;   // 0-23
     timezone: string;  // IANA timezone (e.g., 'America/New_York')
   }
   
   function shouldSendNotification(
     scheduledTime: Date,
     quietHours: QuietHoursConfig
   ): boolean {
     // If quiet hours disabled, always send
     if (!quietHours.enabled) {
       return true;
     }
     
     // Validate timezone
     if (!quietHours.timezone) {
       console.warn('Worker timezone not set, defaulting to UTC');
       quietHours.timezone = 'UTC';
     }
     
     try {
       // Convert scheduled time to worker's timezone
       const zonedTime = utcToZonedTime(scheduledTime, quietHours.timezone);
       const hour = zonedTime.getHours();
       
       // Check if in quiet hours
       const inQuietHours = isInQuietHours(
         hour,
         quietHours.startHour,
         quietHours.endHour
       );
       
       if (inQuietHours) {
         console.log(
           `Notification scheduled for ${format(zonedTime, 'yyyy-MM-dd HH:mm:ss zzz', { timeZone: quietHours.timezone })} ` +
           `is within quiet hours (${quietHours.startHour}:00 - ${quietHours.endHour}:00)`
         );
         return false;
       }
       
       return true;
       
     } catch (error) {
       console.error(`Invalid timezone ${quietHours.timezone}:`, error);
       // Fail open - send notification if timezone is invalid
       return true;
     }
   }
   
   function isInQuietHours(
     currentHour: number,
     startHour: number,
     endHour: number
   ): boolean {
     // Handle cases where quiet hours span midnight
     if (startHour < endHour) {
       // Normal case: e.g., 22:00 - 08:00 next day
       return currentHour >= startHour && currentHour < endHour;
     } else {
       // Spans midnight: e.g., 22:00 - 08:00
       return currentHour >= startHour || currentHour < endHour;
     }
   }
   ```

4. **Update Notification Scheduler**:
   ```typescript
   async function scheduleNotification(
     workerId: string,
     message: NotificationMessage,
     scheduledFor: Date,
     organizationId: string
   ): Promise<Notification> {
     // Fetch worker with quiet hours settings
     const worker = await db.query.worker.findFirst({
       where: and(
         eq(worker.id, workerId),
         eq(worker.organizationId, organizationId)
       )
     });
     
     if (!worker) {
       throw new NotFoundError('Worker not found');
     }
     
     // Check quiet hours in worker's timezone
     const quietHours: QuietHoursConfig = {
       enabled: worker.quietHoursEnabled,
       startHour: worker.quietHoursStart,
       endHour: worker.quietHoursEnd,
       timezone: worker.timezone || 'UTC'
     };
     
     const shouldSend = shouldSendNotification(scheduledFor, quietHours);
     
     if (!shouldSend) {
       // Reschedule to after quiet hours
       const rescheduledTime = calculateNextAvailableTime(
         scheduledFor,
         quietHours
       );
       
       console.log(
         `Rescheduling notification from ${scheduledFor.toISOString()} ` +
         `to ${rescheduledTime.toISOString()} due to quiet hours`
       );
       
       scheduledFor = rescheduledTime;
     }
     
     // Create notification
     const notification = await db.insert(notification).values({
       workerId,
       organizationId,
       title: message.title,
       body: message.body,
       data: message.data,
       scheduledFor,
       status: 'pending',
       createdAt: new Date()
     }).returning();
     
     return notification[0];
   }
   
   function calculateNextAvailableTime(
     originalTime: Date,
     quietHours: QuietHoursConfig
   ): Date {
     const zonedTime = utcToZonedTime(originalTime, quietHours.timezone);
     const hour = zonedTime.getHours();
     
     // If in quiet hours, schedule for end of quiet hours
     if (isInQuietHours(hour, quietHours.startHour, quietHours.endHour)) {
       const nextAvailable = new Date(zonedTime);
       nextAvailable.setHours(quietHours.endHour, 0, 0, 0);
       
       // If end hour is earlier than current hour (spans midnight),
       // schedule for next day
       if (quietHours.endHour <= hour && quietHours.startHour > quietHours.endHour) {
         nextAvailable.setDate(nextAvailable.getDate() + 1);
       }
       
       // Convert back to UTC
       return zonedTimeToUtc(nextAvailable, quietHours.timezone);
     }
     
     return originalTime;
   }
   ```

5. **Add Timezone Selection UI**:
   ```typescript
   // Frontend timezone selector
   import { getTimeZones } from '@vvo/tzdb';
   
   export const TimezoneSelector = ({ value, onChange }) => {
     const timezones = getTimeZones();
     
     return (
       <select value={value} onChange={e => onChange(e.target.value)}>
         <option value="">Select timezone...</option>
         {timezones.map(tz => (
           <option key={tz.name} value={tz.name}>
             {tz.name} ({tz.currentTimeFormat})
           </option>
         ))}
       </select>
     );
   };
   ```

6. **Add Migration for Existing Workers**:
   ```typescript
   // scripts/migrate-worker-timezones.ts
   
   async function migrateWorkerTimezones(): Promise<void> {
     console.log('Migrating worker timezones...');
     
     // Get all workers without timezone set
     const workers = await db.query.worker.findMany({
       where: or(
         isNull(worker.timezone),
         eq(worker.timezone, '')
       ),
       with: {
         organization: true
       }
     });
     
     console.log(`Found ${workers.length} workers without timezone`);
     
     for (const w of workers) {
       // Infer timezone from organization or default to UTC
       const timezone = w.organization?.timezone || 'UTC';
       
       await db.update(worker)
         .set({ timezone })
         .where(eq(worker.id, w.id));
       
       console.log(`Set worker ${w.id} timezone to ${timezone}`);
     }
     
     console.log('Migration complete');
   }
   ```

**Migration Strategy**:
1. Add timezone columns to worker and shift tables
2. Run migration script to set default timezones for existing workers
3. Deploy timezone-aware quiet hours logic
4. Update mobile app to allow workers to set their timezone
5. Monitor notification delivery times to verify correct timezone handling

**Rollback Plan**:
- Revert to server-time quiet hours logic
- Timezone columns can remain (no harm) or be dropped
- No data loss - only affects future notification scheduling

**Testing Considerations**:
- Test with workers in different timezones (US East, US West, Europe, Asia)
- Test quiet hours that span midnight (e.g., 22:00 - 08:00)
- Test timezone changes (worker moves to different timezone)
- Test invalid timezone handling


## Testing Strategy

### Validation Approach

The testing strategy follows a three-phase approach:

1. **Exploratory Fault Condition Checking**: Surface counterexamples that demonstrate each bug on unfixed code to confirm root cause analysis
2. **Fix Checking**: Verify that for all inputs where bug conditions hold, the fixed system produces expected behavior
3. **Preservation Checking**: Verify that for all inputs where bug conditions do NOT hold, the fixed system produces the same results as the original system

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate bugs BEFORE implementing fixes. Confirm or refute root cause hypotheses.

#### Race Condition Tests (Run on Unfixed Code)

**RACE-001: Duplicate Clock-Out**
```typescript
// Test: Concurrent clock-out requests
describe('RACE-001: Duplicate Clock-Out (Unfixed)', () => {
  it('should demonstrate race condition with concurrent requests', async () => {
    const assignmentId = 'test-assignment-123';
    
    // Create assignment in clocked-in state
    await setupAssignment(assignmentId, { actualClockOut: null });
    
    // Fire two concurrent clock-out requests
    const [result1, result2] = await Promise.allSettled([
      clockOut(assignmentId),
      clockOut(assignmentId)
    ]);
    
    // EXPECTED FAILURE: Both requests succeed (race condition)
    expect(result1.status).toBe('fulfilled');
    expect(result2.status).toBe('fulfilled'); // Should fail but doesn't
    
    // Verify data corruption
    const assignment = await getAssignment(assignmentId);
    // May have inconsistent state or duplicate records
  });
});
```

**RACE-002: Double-Booking Workers**
```typescript
describe('RACE-002: Double-Booking (Unfixed)', () => {
  it('should demonstrate race condition with overlapping shift assignments', async () => {
    const workerId = 'worker-123';
    const timeRange = { start: '2024-01-15T09:00:00Z', end: '2024-01-15T17:00:00Z' };
    
    // Fire two concurrent shift publishing requests for same worker
    const [result1, result2] = await Promise.allSettled([
      publishShift({ workerId, ...timeRange, locationId: 'loc-1' }),
      publishShift({ workerId, ...timeRange, locationId: 'loc-2' })
    ]);
    
    // EXPECTED FAILURE: Both requests succeed (double-booking)
    expect(result1.status).toBe('fulfilled');
    expect(result2.status).toBe('fulfilled'); // Should fail but doesn't
    
    // Verify worker is double-booked
    const assignments = await getWorkerAssignments(workerId, timeRange);
    expect(assignments.length).toBe(2); // Worker assigned to 2 overlapping shifts
  });
});
```

**RACE-003: Duplicate Notifications**
```typescript
describe('RACE-003: Duplicate Notifications (Unfixed)', () => {
  it('should demonstrate race condition with same idempotency key', async () => {
    const idempotencyKey = 'shift-reminder-123';
    const payload1 = { shiftId: '123', message: 'Shift starts in 1 hour' };
    const payload2 = { shiftId: '123', message: 'Shift starts soon' }; // Different payload
    
    // Fire concurrent requests with same key but different payloads
    const [result1, result2] = await Promise.allSettled([
      scheduleNotification({ idempotencyKey, ...payload1 }),
      scheduleNotification({ idempotencyKey, ...payload2 })
    ]);
    
    // EXPECTED FAILURE: Both requests create notifications
    expect(result1.status).toBe('fulfilled');
    expect(result2.status).toBe('fulfilled'); // Should fail but doesn't
    
    // Verify duplicate notifications created
    const notifications = await getNotificationsByKey(idempotencyKey);
    expect(notifications.length).toBeGreaterThan(1);
  });
});
```

#### Tenant Isolation Tests (Run on Unfixed Code)

**TENANT-001: Availability Query Leak**
```typescript
describe('TENANT-001: Availability Leak (Unfixed)', () => {
  it('should demonstrate cross-tenant data exposure', async () => {
    // Setup: Create workers in different organizations
    await setupWorker('worker-org-a', 'org-a', { availability: [...] });
    await setupWorker('worker-org-b', 'org-b', { availability: [...] });
    
    // Query availability for org-a
    const availability = await getWorkerAvailability(['worker-org-a', 'worker-org-b'], 'org-a');
    
    // EXPECTED FAILURE: Returns availability from org-b
    const orgBData = availability.filter(a => a.organizationId === 'org-b');
    expect(orgBData.length).toBeGreaterThan(0); // Should be 0 but isn't
  });
});
```

**TENANT-002: Location Ingestion Leak**
```typescript
describe('TENANT-002: Location Leak (Unfixed)', () => {
  it('should demonstrate cross-tenant location access', async () => {
    // Setup: Create location data in different organizations
    await setupWorkerLocation('worker-org-a', 'org-a');
    await setupWorkerLocation('worker-org-b', 'org-b');
    
    // Ingest location for org-a worker
    const result = await ingestLocation({
      workerId: 'worker-org-a',
      // Missing organizationId parameter
    });
    
    // EXPECTED FAILURE: Query may access org-b data
    // Verify by checking query logs or returned data
  });
});
```

**TENANT-003: Invitation Token Bypass**
```typescript
describe('TENANT-003: Invitation Bypass (Unfixed)', () => {
  it('should demonstrate unauthorized invitation creation', async () => {
    // Setup: Create non-admin user
    const nonAdminUser = await setupUser('non-admin', 'org-a', 'worker');
    
    // Attempt to create invitation as non-admin
    const result = await createInvitation({
      inviterId: nonAdminUser.id,
      organizationId: 'org-a',
      email: 'newuser@example.com'
    });
    
    // EXPECTED FAILURE: Non-admin can create invitations
    expect(result.status).toBe('success'); // Should fail but doesn't
  });
});
```

#### Geofencing Tests (Run on Unfixed Code)

**GEO-001: Excessive GPS Accuracy**
```typescript
describe('GEO-001: GPS Accuracy (Unfixed)', () => {
  it('should demonstrate acceptance of low-accuracy GPS', async () => {
    const location = {
      lat: 40.7128,
      lng: -74.0060,
      accuracy: 180 // Very poor accuracy
    };
    
    // Attempt clock-in with poor GPS
    const result = await clockIn('assignment-123', location);
    
    // EXPECTED FAILURE: System accepts low-accuracy location
    expect(result.success).toBe(true); // Should fail but doesn't
    expect(result.verified).toBe(true);
  });
});
```

**GEO-002: Missing Spatial Index**
```typescript
describe('GEO-002: Spatial Index (Unfixed)', () => {
  it('should demonstrate slow geofence queries', async () => {
    // Setup: Create many locations
    await setupManyLocations(10000);
    
    const start = performance.now();
    await checkGeofence({ lat: 40.7128, lng: -74.0060 }, 'location-5000');
    const duration = performance.now() - start;
    
    // EXPECTED FAILURE: Query is slow without GIST index
    expect(duration).toBeGreaterThan(100); // Slow query
  });
});
```

**GEO-003: Invalid Geofence Radius**
```typescript
describe('GEO-003: Geofence Radius (Unfixed)', () => {
  it('should demonstrate acceptance of invalid radius values', async () => {
    // Attempt to create location with invalid radius
    const result = await createLocation({
      name: 'Test Location',
      lat: 40.7128,
      lng: -74.0060,
      geofenceRadius: 0 // Invalid
    });
    
    // EXPECTED FAILURE: System accepts invalid radius
    expect(result.success).toBe(true); // Should fail but doesn't
    
    // Try extreme value
    const result2 = await updateLocation('loc-123', { geofenceRadius: 10000 });
    expect(result2.success).toBe(true); // Should fail but doesn't
  });
});
```


#### Notification System Tests (Run on Unfixed Code)

**NOTIF-001: Token Mapping Loss**
```typescript
describe('NOTIF-001: Token Mapping (Unfixed)', () => {
  it('should demonstrate incorrect token attribution', async () => {
    // Setup: Create batch with some invalid tokens
    const notifications = [
      { id: '1', pushToken: 'valid-token-1', message: 'Test 1' },
      { id: '2', pushToken: 'invalid-token', message: 'Test 2' },
      { id: '3', pushToken: 'valid-token-2', message: 'Test 3' },
      { id: '4', pushToken: 'valid-token-3', message: 'Test 4' }
    ];
    
    // Send batch (will filter invalid tokens)
    await sendBatchNotifications(notifications);
    
    // EXPECTED FAILURE: Wrong tokens marked inactive
    const token1 = await getDeviceToken('valid-token-1');
    const token2 = await getDeviceToken('valid-token-2');
    
    // Due to index shifting, wrong token may be marked inactive
    // This is hard to test deterministically but can be observed in logs
  });
});
```

**NOTIF-002: Duplicate Token Notifications**
```typescript
describe('NOTIF-002: Duplicate Tokens (Unfixed)', () => {
  it('should demonstrate duplicate notification delivery', async () => {
    const workerId = 'worker-123';
    const pushToken = 'ExponentPushToken[abc123]';
    
    // Setup: Register same token multiple times
    await registerDeviceToken(workerId, pushToken, { device: 'iPhone 1' });
    await registerDeviceToken(workerId, pushToken, { device: 'iPhone 2' }); // Duplicate
    
    // Send notification to worker
    const sentCount = await sendNotificationToWorker(workerId, {
      title: 'Test',
      body: 'Test message'
    });
    
    // EXPECTED FAILURE: Notification sent multiple times
    expect(sentCount).toBeGreaterThan(1); // Should be 1 but isn't
  });
});
```

**NOTIF-004: Timezone-Unaware Quiet Hours**
```typescript
describe('NOTIF-004: Quiet Hours Timezone (Unfixed)', () => {
  it('should demonstrate timezone-unaware quiet hours', async () => {
    // Setup: Worker in US Eastern timezone with quiet hours 22:00-08:00
    const worker = await setupWorker('worker-123', {
      timezone: 'America/New_York',
      quietHoursEnabled: true,
      quietHoursStart: 22,
      quietHoursEnd: 8
    });
    
    // Schedule notification for 23:00 Eastern (03:00 UTC next day)
    // If server is in UTC, it will compare 03:00 against quiet hours
    const scheduledTime = new Date('2024-01-15T03:00:00Z'); // 23:00 Eastern
    
    const shouldSend = shouldSendNotification(scheduledTime, worker);
    
    // EXPECTED FAILURE: System thinks it's OK to send (03:00 UTC not in 22-08 range)
    expect(shouldSend).toBe(true); // Should be false (23:00 Eastern is in quiet hours)
  });
});
```

### Fix Checking

**Goal**: Verify that for all inputs where bug conditions hold, the fixed system produces expected behavior.

#### Race Condition Fix Verification

```typescript
describe('Race Condition Fixes', () => {
  describe('RACE-001: Duplicate Clock-Out (Fixed)', () => {
    it('should prevent concurrent clock-outs', async () => {
      const assignmentId = 'test-assignment-123';
      await setupAssignment(assignmentId, { actualClockOut: null });
      
      // Fire concurrent requests
      const [result1, result2] = await Promise.allSettled([
        clockOut(assignmentId),
        clockOut(assignmentId)
      ]);
      
      // One should succeed, one should fail
      const succeeded = [result1, result2].filter(r => r.status === 'fulfilled');
      const failed = [result1, result2].filter(r => r.status === 'rejected');
      
      expect(succeeded.length).toBe(1);
      expect(failed.length).toBe(1);
      expect(failed[0].reason.message).toContain('already clocked out');
    });
  });
  
  describe('RACE-002: Double-Booking (Fixed)', () => {
    it('should prevent concurrent overlapping assignments', async () => {
      const workerId = 'worker-123';
      const timeRange = { start: '2024-01-15T09:00:00Z', end: '2024-01-15T17:00:00Z' };
      
      const [result1, result2] = await Promise.allSettled([
        publishShift({ workerId, ...timeRange, locationId: 'loc-1' }),
        publishShift({ workerId, ...timeRange, locationId: 'loc-2' })
      ]);
      
      const succeeded = [result1, result2].filter(r => r.status === 'fulfilled');
      const failed = [result1, result2].filter(r => r.status === 'rejected');
      
      expect(succeeded.length).toBe(1);
      expect(failed.length).toBe(1);
      expect(failed[0].reason.message).toContain('conflict');
    });
  });
  
  describe('RACE-003: Duplicate Notifications (Fixed)', () => {
    it('should reject requests with same key but different payload', async () => {
      const idempotencyKey = 'shift-reminder-123';
      
      const result1 = await scheduleNotification({
        idempotencyKey,
        payload: { message: 'Version 1' }
      });
      
      await expect(
        scheduleNotification({
          idempotencyKey,
          payload: { message: 'Version 2' } // Different payload
        })
      ).rejects.toThrow('already used with different payload');
    });
    
    it('should return cached response for identical requests', async () => {
      const idempotencyKey = 'shift-reminder-456';
      const payload = { message: 'Same message' };
      
      const result1 = await scheduleNotification({ idempotencyKey, payload });
      const result2 = await scheduleNotification({ idempotencyKey, payload });
      
      expect(result1.id).toBe(result2.id); // Same notification returned
    });
  });
});
```

#### Tenant Isolation Fix Verification

```typescript
describe('Tenant Isolation Fixes', () => {
  describe('TENANT-001: Availability Query (Fixed)', () => {
    it('should only return same-organization availability', async () => {
      await setupWorker('worker-org-a', 'org-a', { availability: [...] });
      await setupWorker('worker-org-b', 'org-b', { availability: [...] });
      
      const availability = await getWorkerAvailability(
        ['worker-org-a', 'worker-org-b'],
        'org-a' // Request for org-a only
      );
      
      // Should only return org-a data
      expect(availability.every(a => a.organizationId === 'org-a')).toBe(true);
      expect(availability.some(a => a.organizationId === 'org-b')).toBe(false);
    });
  });
  
  describe('TENANT-002: Location Ingestion (Fixed)', () => {
    it('should only access same-organization location data', async () => {
      await setupWorkerLocation('worker-org-a', 'org-a');
      await setupWorkerLocation('worker-org-b', 'org-b');
      
      const result = await ingestLocation({
        workerId: 'worker-org-a',
        organizationId: 'org-a'
      });
      
      // Verify no cross-tenant access by checking query logs or data
      expect(result.organizationId).toBe('org-a');
    });
  });
  
  describe('TENANT-003: Invitation Token (Fixed)', () => {
    it('should reject invitation creation by non-admins', async () => {
      const nonAdmin = await setupUser('non-admin', 'org-a', 'worker');
      
      await expect(
        createInvitation({
          inviterId: nonAdmin.id,
          organizationId: 'org-a',
          email: 'newuser@example.com'
        })
      ).rejects.toThrow('Only active admins can create invitations');
    });
    
    it('should allow invitation creation by admins', async () => {
      const admin = await setupUser('admin', 'org-a', 'admin');
      
      const result = await createInvitation({
        inviterId: admin.id,
        organizationId: 'org-a',
        email: 'newuser@example.com'
      });
      
      expect(result.status).toBe('pending');
    });
  });
});
```


#### Geofencing Fix Verification

```typescript
describe('Geofencing Fixes', () => {
  describe('GEO-001: GPS Accuracy (Fixed)', () => {
    it('should reject location with accuracy > 50m', async () => {
      const location = {
        lat: 40.7128,
        lng: -74.0060,
        accuracy: 180
      };
      
      await expect(
        clockIn('assignment-123', location)
      ).rejects.toThrow('GPS accuracy too low');
    });
    
    it('should accept location with accuracy <= 50m', async () => {
      const location = {
        lat: 40.7128,
        lng: -74.0060,
        accuracy: 30
      };
      
      const result = await clockIn('assignment-123', location);
      expect(result.success).toBe(true);
    });
  });
  
  describe('GEO-002: Spatial Index (Fixed)', () => {
    it('should execute geofence queries quickly', async () => {
      await setupManyLocations(10000);
      
      const start = performance.now();
      await checkGeofence({ lat: 40.7128, lng: -74.0060 }, 'location-5000');
      const duration = performance.now() - start;
      
      // Should be fast with GIST index
      expect(duration).toBeLessThan(50); // < 50ms
    });
  });
  
  describe('GEO-003: Geofence Radius (Fixed)', () => {
    it('should reject radius < 10m', async () => {
      await expect(
        createLocation({
          name: 'Test',
          lat: 40.7128,
          lng: -74.0060,
          geofenceRadius: 5
        })
      ).rejects.toThrow('must be at least 10 meters');
    });
    
    it('should reject radius > 500m', async () => {
      await expect(
        updateLocation('loc-123', { geofenceRadius: 1000 })
      ).rejects.toThrow('must not exceed 500 meters');
    });
    
    it('should accept valid radius', async () => {
      const result = await createLocation({
        name: 'Test',
        lat: 40.7128,
        lng: -74.0060,
        geofenceRadius: 100
      });
      
      expect(result.geofenceRadius).toBe(100);
    });
  });
});
```

#### Notification System Fix Verification

```typescript
describe('Notification System Fixes', () => {
  describe('NOTIF-001: Token Mapping (Fixed)', () => {
    it('should correctly attribute errors to source tokens', async () => {
      const notifications = [
        { id: '1', pushToken: 'valid-token-1', message: 'Test 1' },
        { id: '2', pushToken: 'invalid-token', message: 'Test 2' },
        { id: '3', pushToken: 'valid-token-2', message: 'Test 3' }
      ];
      
      const results = await sendBatchNotifications(notifications);
      
      // Verify correct mapping
      expect(results[0].pushToken).toBe('valid-token-1');
      expect(results[0].status).toBe('success');
      
      expect(results[1].pushToken).toBe('invalid-token');
      expect(results[1].status).toBe('error');
      
      expect(results[2].pushToken).toBe('valid-token-2');
      expect(results[2].status).toBe('success');
    });
  });
  
  describe('NOTIF-002: Duplicate Tokens (Fixed)', () => {
    it('should deduplicate tokens before sending', async () => {
      const workerId = 'worker-123';
      const pushToken = 'ExponentPushToken[abc123]';
      
      // Register same token multiple times
      await registerDeviceToken(workerId, pushToken, { device: 'iPhone 1' });
      await registerDeviceToken(workerId, pushToken, { device: 'iPhone 2' });
      
      const results = await sendNotificationToWorker(workerId, {
        title: 'Test',
        body: 'Test message'
      });
      
      // Should only send once
      expect(results.length).toBe(1);
      expect(results[0].pushToken).toBe(pushToken);
    });
  });
  
  describe('NOTIF-004: Quiet Hours Timezone (Fixed)', () => {
    it('should respect quiet hours in worker timezone', async () => {
      const worker = {
        timezone: 'America/New_York',
        quietHoursEnabled: true,
        quietHoursStart: 22,
        quietHoursEnd: 8
      };
      
      // 23:00 Eastern = 03:00 UTC (next day)
      const scheduledTime = new Date('2024-01-15T03:00:00Z');
      
      const shouldSend = shouldSendNotification(scheduledTime, worker);
      
      // Should NOT send (23:00 Eastern is in quiet hours)
      expect(shouldSend).toBe(false);
    });
    
    it('should allow notifications outside quiet hours', async () => {
      const worker = {
        timezone: 'America/New_York',
        quietHoursEnabled: true,
        quietHoursStart: 22,
        quietHoursEnd: 8
      };
      
      // 10:00 Eastern = 14:00 UTC
      const scheduledTime = new Date('2024-01-15T14:00:00Z');
      
      const shouldSend = shouldSendNotification(scheduledTime, worker);
      
      // Should send (10:00 Eastern is outside quiet hours)
      expect(shouldSend).toBe(true);
    });
  });
});
```

### Preservation Checking

**Goal**: Verify that for all inputs where bug conditions do NOT hold, the fixed system produces the same results as the original system.

#### Preservation Tests

```typescript
describe('Preservation Tests', () => {
  describe('Single-Request Operations', () => {
    it('should handle single clock-out without changes', async () => {
      const assignmentId = 'test-assignment';
      await setupAssignment(assignmentId, { actualClockOut: null });
      
      const result = await clockOut(assignmentId);
      
      expect(result.success).toBe(true);
      expect(result.actualClockOut).toBeDefined();
      expect(result.status).toBe('completed');
    });
    
    it('should handle non-overlapping shift publishing', async () => {
      const worker1 = 'worker-1';
      const worker2 = 'worker-2';
      
      const results = await Promise.all([
        publishShift({ workerId: worker1, start: '09:00', end: '17:00' }),
        publishShift({ workerId: worker2, start: '09:00', end: '17:00' })
      ]);
      
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });
  });
  
  describe('Same-Tenant Operations', () => {
    it('should return correct availability for same-org queries', async () => {
      const worker = await setupWorker('worker-1', 'org-a', {
        availability: [{ day: 'monday', start: '09:00', end: '17:00' }]
      });
      
      const availability = await getWorkerAvailability(['worker-1'], 'org-a');
      
      expect(availability.length).toBe(1);
      expect(availability[0].workerId).toBe('worker-1');
    });
  });
  
  describe('Valid Geofence Operations', () => {
    it('should accept clock-in with good GPS accuracy', async () => {
      const location = { lat: 40.7128, lng: -74.0060, accuracy: 20 };
      
      const result = await clockIn('assignment-123', location);
      
      expect(result.success).toBe(true);
      expect(result.accuracy).toBe(20);
    });
    
    it('should accept valid geofence radius', async () => {
      const result = await createLocation({
        name: 'Office',
        lat: 40.7128,
        lng: -74.0060,
        geofenceRadius: 100
      });
      
      expect(result.geofenceRadius).toBe(100);
    });
  });
  
  describe('Single-Token Notifications', () => {
    it('should deliver to single unique token', async () => {
      const workerId = 'worker-123';
      await registerDeviceToken(workerId, 'token-1', {});
      
      const results = await sendNotificationToWorker(workerId, {
        title: 'Test',
        body: 'Message'
      });
      
      expect(results.length).toBe(1);
      expect(results[0].status).toBe('success');
    });
    
    it('should send when quiet hours disabled', async () => {
      const worker = {
        quietHoursEnabled: false,
        quietHoursStart: 22,
        quietHoursEnd: 8
      };
      
      // Even during "quiet hours", should send
      const scheduledTime = new Date('2024-01-15T23:00:00Z');
      const shouldSend = shouldSendNotification(scheduledTime, worker);
      
      expect(shouldSend).toBe(true);
    });
  });
});
```

### Property-Based Tests

```typescript
import fc from 'fast-check';

describe('Property-Based Tests', () => {
  describe('Race Condition Properties', () => {
    it('Property: Only one concurrent clock-out succeeds', () => {
      fc.assert(
        fc.asyncProperty(
          fc.uuid(), // assignmentId
          fc.nat(10), // number of concurrent requests
          async (assignmentId, concurrency) => {
            await setupAssignment(assignmentId, { actualClockOut: null });
            
            const requests = Array(concurrency)
              .fill(null)
              .map(() => clockOut(assignmentId));
            
            const results = await Promise.allSettled(requests);
            const succeeded = results.filter(r => r.status === 'fulfilled');
            
            // Only one should succeed
            return succeeded.length === 1;
          }
        )
      );
    });
  });
  
  describe('Tenant Isolation Properties', () => {
    it('Property: Queries never return cross-tenant data', () => {
      fc.assert(
        fc.asyncProperty(
          fc.uuid(), // orgId
          fc.array(fc.uuid()), // workerIds
          async (orgId, workerIds) => {
            const availability = await getWorkerAvailability(workerIds, orgId);
            
            // All results must belong to requested organization
            return availability.every(a => a.organizationId === orgId);
          }
        )
      );
    });
  });
  
  describe('Geofencing Properties', () => {
    it('Property: GPS accuracy > 50m always rejected', () => {
      fc.assert(
        fc.asyncProperty(
          fc.double({ min: 50.01, max: 1000 }), // accuracy > 50
          fc.double({ min: -90, max: 90 }), // lat
          fc.double({ min: -180, max: 180 }), // lng
          async (accuracy, lat, lng) => {
            const location = { lat, lng, accuracy };
            
            try {
              await clockIn('test-assignment', location);
              return false; // Should have thrown
            } catch (error) {
              return error.message.includes('GPS accuracy too low');
            }
          }
        )
      );
    });
    
    it('Property: Geofence radius outside 10-500 always rejected', () => {
      fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.integer({ min: -1000, max: 9 }),
            fc.integer({ min: 501, max: 10000 })
          ),
          async (radius) => {
            try {
              await createLocation({
                name: 'Test',
                lat: 40.7128,
                lng: -74.0060,
                geofenceRadius: radius
              });
              return false; // Should have thrown
            } catch (error) {
              return error.message.includes('between 10 and 500');
            }
          }
        )
      );
    });
  });
});
```


### Integration Tests

```typescript
describe('Integration Tests', () => {
  describe('End-to-End Shift Management', () => {
    it('should handle complete shift lifecycle with fixes', async () => {
      // Setup organization and workers
      const org = await createOrganization('Test Org');
      const admin = await createUser('admin@test.com', org.id, 'admin');
      const worker = await createWorker('worker@test.com', org.id, {
        timezone: 'America/New_York',
        quietHoursEnabled: true,
        quietHoursStart: 22,
        quietHoursEnd: 8
      });
      
      // Create location with valid geofence
      const location = await createLocation({
        name: 'Office',
        lat: 40.7128,
        lng: -74.0060,
        geofenceRadius: 100,
        organizationId: org.id
      });
      
      // Publish shift (tenant-scoped)
      const shift = await publishShift({
        organizationId: org.id,
        locationId: location.id,
        workerId: worker.id,
        start: '2024-01-15T09:00:00Z',
        end: '2024-01-15T17:00:00Z'
      });
      
      // Verify no double-booking possible
      await expect(
        publishShift({
          organizationId: org.id,
          locationId: location.id,
          workerId: worker.id,
          start: '2024-01-15T09:00:00Z',
          end: '2024-01-15T17:00:00Z'
        })
      ).rejects.toThrow('conflict');
      
      // Clock in with valid GPS
      const clockInResult = await clockIn(shift.assignmentId, {
        lat: 40.7128,
        lng: -74.0060,
        accuracy: 25
      });
      expect(clockInResult.verified).toBe(true);
      
      // Clock out (only once)
      const clockOutResult = await clockOut(shift.assignmentId);
      expect(clockOutResult.success).toBe(true);
      
      // Verify second clock-out fails
      await expect(
        clockOut(shift.assignmentId)
      ).rejects.toThrow('already clocked out');
      
      // Schedule notification (respects quiet hours)
      const notification = await scheduleNotification({
        workerId: worker.id,
        message: { title: 'Shift Complete', body: 'Good job!' },
        scheduledFor: new Date('2024-01-15T23:00:00-05:00') // 23:00 Eastern
      });
      
      // Should be rescheduled to after quiet hours
      expect(notification.scheduledFor.getHours()).toBe(8); // 08:00 Eastern
    });
  });
  
  describe('Multi-Tenant Isolation', () => {
    it('should maintain complete isolation between organizations', async () => {
      // Setup two organizations
      const orgA = await createOrganization('Org A');
      const orgB = await createOrganization('Org B');
      
      const workerA = await createWorker('worker-a@test.com', orgA.id);
      const workerB = await createWorker('worker-b@test.com', orgB.id);
      
      // Create shifts in both orgs
      const shiftA = await publishShift({
        organizationId: orgA.id,
        workerId: workerA.id,
        start: '2024-01-15T09:00:00Z',
        end: '2024-01-15T17:00:00Z'
      });
      
      const shiftB = await publishShift({
        organizationId: orgB.id,
        workerId: workerB.id,
        start: '2024-01-15T09:00:00Z',
        end: '2024-01-15T17:00:00Z'
      });
      
      // Verify org A cannot access org B data
      const availabilityA = await getWorkerAvailability([workerA.id, workerB.id], orgA.id);
      expect(availabilityA.every(a => a.organizationId === orgA.id)).toBe(true);
      
      // Verify org B cannot access org A data
      const availabilityB = await getWorkerAvailability([workerA.id, workerB.id], orgB.id);
      expect(availabilityB.every(a => a.organizationId === orgB.id)).toBe(true);
      
      // Verify non-admin cannot create invitations
      await expect(
        createInvitation({
          inviterId: workerA.id, // Worker, not admin
          organizationId: orgA.id,
          email: 'new@test.com'
        })
      ).rejects.toThrow('Only active admins');
    });
  });
  
  describe('Notification System Integration', () => {
    it('should handle complete notification flow with fixes', async () => {
      const worker = await createWorker('worker@test.com', 'org-1', {
        timezone: 'America/Los_Angeles'
      });
      
      // Register device tokens (with duplicate)
      const token = 'ExponentPushToken[abc123]';
      await registerDeviceToken(worker.id, token, { device: 'iPhone 1' });
      await registerDeviceToken(worker.id, token, { device: 'iPhone 2' }); // Duplicate
      
      // Send notification
      const results = await sendNotificationToWorker(worker.id, {
        title: 'Test',
        body: 'Message'
      });
      
      // Should only send once (deduplication)
      expect(results.length).toBe(1);
      expect(results[0].pushToken).toBe(token);
      expect(results[0].status).toBe('success');
      
      // Schedule with idempotency
      const idempotencyKey = 'test-notification-1';
      const notification1 = await scheduleNotification({
        idempotencyKey,
        workerId: worker.id,
        payload: { message: 'Test' }
      });
      
      // Duplicate request returns same notification
      const notification2 = await scheduleNotification({
        idempotencyKey,
        workerId: worker.id,
        payload: { message: 'Test' }
      });
      
      expect(notification1.id).toBe(notification2.id);
      
      // Different payload rejected
      await expect(
        scheduleNotification({
          idempotencyKey,
          workerId: worker.id,
          payload: { message: 'Different' }
        })
      ).rejects.toThrow('different payload');
    });
  });
});
```

### Performance Tests

```typescript
describe('Performance Tests', () => {
  describe('Geofence Query Performance', () => {
    it('should handle high-volume geofence checks efficiently', async () => {
      // Setup 10,000 locations
      await setupManyLocations(10000);
      
      const iterations = 1000;
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        await checkGeofence(
          { lat: 40.7128 + (i * 0.001), lng: -74.0060 + (i * 0.001) },
          `location-${i % 10000}`
        );
      }
      
      const duration = performance.now() - start;
      const avgDuration = duration / iterations;
      
      console.log(`Average geofence query: ${avgDuration.toFixed(2)}ms`);
      
      // Should average < 20ms per query with GIST index
      expect(avgDuration).toBeLessThan(20);
    });
  });
  
  describe('Concurrent Request Handling', () => {
    it('should handle high concurrency without deadlocks', async () => {
      const workers = await setupManyWorkers(100);
      
      // Fire 100 concurrent shift publishing requests
      const requests = workers.map(worker =>
        publishShift({
          workerId: worker.id,
          start: '2024-01-15T09:00:00Z',
          end: '2024-01-15T17:00:00Z'
        })
      );
      
      const start = performance.now();
      const results = await Promise.allSettled(requests);
      const duration = performance.now() - start;
      
      const succeeded = results.filter(r => r.status === 'fulfilled');
      
      console.log(`Processed ${succeeded.length} shifts in ${duration.toFixed(0)}ms`);
      
      // All should succeed (no overlaps)
      expect(succeeded.length).toBe(100);
      
      // Should complete in reasonable time
      expect(duration).toBeLessThan(5000); // < 5 seconds
    });
  });
  
  describe('Notification Batch Performance', () => {
    it('should handle large notification batches efficiently', async () => {
      const workers = await setupManyWorkers(1000);
      
      // Register tokens for all workers
      for (const worker of workers) {
        await registerDeviceToken(worker.id, `token-${worker.id}`, {});
      }
      
      // Send batch notification
      const start = performance.now();
      const results = await sendBatchNotifications(
        workers.map(w => ({
          id: `notif-${w.id}`,
          pushToken: `token-${w.id}`,
          message: { title: 'Test', body: 'Message' }
        }))
      );
      const duration = performance.now() - start;
      
      console.log(`Sent ${results.length} notifications in ${duration.toFixed(0)}ms`);
      
      // Should complete in reasonable time
      expect(duration).toBeLessThan(10000); // < 10 seconds
      
      // All mappings should be correct
      results.forEach((result, i) => {
        expect(result.pushToken).toBe(`token-${workers[i].id}`);
      });
    });
  });
});
```

### Manual Testing Checklist

**Race Conditions:**
- [ ] Manually trigger concurrent clock-out requests using multiple browser tabs
- [ ] Verify only one succeeds and database state is consistent
- [ ] Test shift publishing with overlapping time ranges from multiple sessions
- [ ] Verify constraint violations are logged correctly

**Tenant Isolation:**
- [ ] Create test data in multiple organizations
- [ ] Verify queries from one org never return data from another
- [ ] Test invitation creation as admin and non-admin users
- [ ] Verify cross-tenant access attempts are blocked

**Geofencing:**
- [ ] Test clock-in with various GPS accuracy values (10m, 50m, 100m, 200m)
- [ ] Verify accuracy threshold is enforced correctly
- [ ] Test geofence radius validation in admin UI
- [ ] Monitor query performance with EXPLAIN ANALYZE

**Notifications:**
- [ ] Register duplicate device tokens and verify deduplication
- [ ] Send batch notifications and verify correct token attribution
- [ ] Test quiet hours with workers in different timezones
- [ ] Verify notifications are rescheduled correctly


## Deployment Strategy

### Phased Rollout Plan

The fixes should be deployed in phases to minimize risk and allow for validation at each stage.

#### Phase 1: Database Schema Changes (Low Risk)

**Objective**: Add database constraints, indexes, and columns without changing application behavior.

**Changes:**
- Add GIST indexes for spatial queries (GEO-002)
- Add CHECK constraint for geofence radius (GEO-003)
- Add unique index on notification idempotency key (RACE-003)
- Add timezone columns to worker and shift tables (NOTIF-004)
- Add payload_hash column to notification table (RACE-003)
- Add accuracy metadata columns to shift_assignment (GEO-001)

**Deployment Steps:**
```sql
-- Run migrations with CONCURRENTLY option to avoid locks
BEGIN;

-- GEO-002: Add GIST index
CREATE INDEX CONCURRENTLY idx_location_position_gist 
ON location USING gist(position);

-- GEO-003: Fix invalid data, then add constraint
UPDATE location 
SET geofence_radius = CASE
  WHEN geofence_radius IS NULL THEN 100
  WHEN geofence_radius < 10 THEN 10
  WHEN geofence_radius > 500 THEN 500
  ELSE geofence_radius
END
WHERE geofence_radius < 10 OR geofence_radius > 500 OR geofence_radius IS NULL;

ALTER TABLE location 
ADD CONSTRAINT check_geofence_radius_range 
CHECK (geofence_radius >= 10 AND geofence_radius <= 500);

-- RACE-003: Add idempotency columns
ALTER TABLE notification 
ADD COLUMN payload_hash VARCHAR(64);

CREATE UNIQUE INDEX CONCURRENTLY idx_notification_idempotency 
ON notification(idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- NOTIF-004: Add timezone columns
ALTER TABLE worker 
ADD COLUMN timezone VARCHAR(50) DEFAULT 'UTC';

ALTER TABLE shift 
ADD COLUMN timezone VARCHAR(50);

-- GEO-001: Add accuracy metadata
ALTER TABLE shift_assignment 
ADD COLUMN clock_in_accuracy DECIMAL(10, 2),
ADD COLUMN clock_in_distance DECIMAL(10, 2),
ADD COLUMN clock_in_warning TEXT,
ADD COLUMN clock_out_accuracy DECIMAL(10, 2),
ADD COLUMN clock_out_distance DECIMAL(10, 2);

COMMIT;
```

**Validation:**
- Verify indexes are created: `\d location`
- Verify constraints are active: `\d+ location`
- Test constraint with invalid data: `UPDATE location SET geofence_radius = 5 WHERE id = 'test-id';`
- Monitor index usage: `SELECT * FROM pg_stat_user_indexes WHERE indexrelname LIKE '%gist%';`

**Rollback:**
```sql
-- Drop indexes and constraints if needed
DROP INDEX CONCURRENTLY idx_location_position_gist;
ALTER TABLE location DROP CONSTRAINT check_geofence_radius_range;
DROP INDEX CONCURRENTLY idx_notification_idempotency;
-- Columns can remain or be dropped in separate migration
```

#### Phase 2: Tenant Isolation Fixes (High Priority)

**Objective**: Fix cross-tenant data leaks immediately.

**Changes:**
- Add organizationId filters to all queries (TENANT-001, TENANT-002)
- Add admin authorization checks (TENANT-003)
- Deploy tenant context middleware

**Deployment Steps:**
1. Deploy code changes to staging environment
2. Run comprehensive tenant isolation tests
3. Deploy to production with monitoring
4. Monitor logs for authorization errors
5. Verify no cross-tenant queries in database logs

**Validation:**
- Query database logs for queries without organizationId filters
- Test with multiple organizations in staging
- Verify authorization errors are logged correctly

**Rollback:**
- Revert code changes to previous version
- No database changes needed

#### Phase 3: Race Condition Fixes (Medium Priority)

**Objective**: Prevent data corruption from concurrent operations.

**Changes:**
- Implement optimistic locking for clock-out (RACE-001)
- Add exclusion constraint for shift assignments (RACE-002)
- Implement atomic idempotency checks (RACE-003)

**Deployment Steps:**
```sql
-- RACE-002: Add exclusion constraint
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE shift_assignment 
ADD CONSTRAINT no_worker_overlap 
EXCLUDE USING gist (
  worker_id WITH =,
  tsrange(scheduled_start, scheduled_end) WITH &&
)
WHERE (status != 'cancelled');
```

1. Deploy database constraint for shift overlaps
2. Deploy application code with optimistic locking
3. Monitor for constraint violations and conflict errors
4. Verify single-request operations still work correctly

**Validation:**
- Test concurrent clock-out requests
- Test concurrent shift publishing
- Verify constraint violations are handled gracefully
- Monitor error rates and response times

**Rollback:**
```sql
ALTER TABLE shift_assignment DROP CONSTRAINT no_worker_overlap;
```
- Revert application code changes

#### Phase 4: Geofencing Fixes (Medium Priority)

**Objective**: Improve location validation accuracy and performance.

**Changes:**
- Add GPS accuracy validation (GEO-001)
- Spatial index already added in Phase 1 (GEO-002)
- Geofence radius constraint already added in Phase 1 (GEO-003)

**Deployment Steps:**
1. Deploy GPS accuracy validation code
2. Update mobile app to request high-accuracy GPS
3. Monitor clock-in success rates
4. Adjust accuracy threshold if needed based on real-world data

**Validation:**
- Test clock-in with various GPS accuracy values
- Monitor clock-in rejection rates
- Verify geofence query performance improvements
- Check for user complaints about clock-in failures

**Rollback:**
- Revert GPS accuracy validation code
- Mobile app changes can remain (no harm)

#### Phase 5: Notification System Fixes (Low Priority)

**Objective**: Improve notification reliability and respect user preferences.

**Changes:**
- Fix token mapping (NOTIF-001)
- Add token deduplication (NOTIF-002)
- Implement timezone-aware quiet hours (NOTIF-004)

**Deployment Steps:**
1. Run token cleanup script to remove duplicates
2. Deploy token deduplication logic
3. Deploy timezone-aware quiet hours
4. Run timezone migration script for existing workers
5. Monitor notification delivery rates

**Validation:**
- Verify token mapping is correct in logs
- Test duplicate token handling
- Test quiet hours with different timezones
- Monitor notification delivery success rates

**Rollback:**
- Revert code changes
- Reactivate tokens if needed

### Monitoring and Alerting

**Key Metrics to Monitor:**

```typescript
// Metrics to track during and after deployment

// Race Conditions
metrics.increment('clock_out.conflict_error'); // Should increase after fix
metrics.increment('shift_publish.overlap_error'); // Should increase after fix
metrics.increment('notification.idempotency_conflict'); // Should increase after fix

// Tenant Isolation
metrics.increment('authorization.forbidden_error'); // Should increase if attacks attempted
metrics.gauge('query.cross_tenant_attempts', 0); // Should remain 0

// Geofencing
metrics.histogram('geofence.query.duration'); // Should decrease after index
metrics.increment('clock_in.accuracy_rejected'); // New metric after fix
metrics.gauge('clock_in.success_rate'); // Should remain stable

// Notifications
metrics.gauge('notification.delivery_rate'); // Should remain stable or improve
metrics.increment('notification.token_deduplication'); // New metric
metrics.increment('notification.quiet_hours_rescheduled'); // New metric
```

**Alerts to Configure:**

```yaml
# Alert if clock-in success rate drops significantly
- alert: ClockInSuccessRateDrop
  expr: rate(clock_in_success[5m]) < 0.8
  for: 10m
  annotations:
    summary: "Clock-in success rate dropped below 80%"
    
# Alert if geofence queries are slow
- alert: SlowGeofenceQueries
  expr: histogram_quantile(0.95, geofence_query_duration) > 100
  for: 5m
  annotations:
    summary: "95th percentile geofence query duration > 100ms"
    
# Alert if notification delivery rate drops
- alert: NotificationDeliveryRateDrop
  expr: rate(notification_delivery_success[5m]) < 0.9
  for: 10m
  annotations:
    summary: "Notification delivery rate dropped below 90%"
    
# Alert if cross-tenant access attempted
- alert: CrossTenantAccessAttempt
  expr: rate(authorization_forbidden[5m]) > 0
  for: 1m
  annotations:
    summary: "Cross-tenant access attempt detected"
```

### Database Migration Scripts

**Migration 001: Add Indexes and Constraints**
```typescript
// migrations/001_add_indexes_and_constraints.ts

export async function up(db: Database) {
  // Add GIST index for spatial queries
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_location_position_gist 
    ON location USING gist(position)
  `);
  
  // Fix invalid geofence radius values
  await db.execute(sql`
    UPDATE location 
    SET geofence_radius = CASE
      WHEN geofence_radius IS NULL THEN 100
      WHEN geofence_radius < 10 THEN 10
      WHEN geofence_radius > 500 THEN 500
      ELSE geofence_radius
    END
    WHERE geofence_radius < 10 OR geofence_radius > 500 OR geofence_radius IS NULL
  `);
  
  // Add CHECK constraint
  await db.execute(sql`
    ALTER TABLE location 
    ADD CONSTRAINT check_geofence_radius_range 
    CHECK (geofence_radius >= 10 AND geofence_radius <= 500)
  `);
  
  // Add notification idempotency columns
  await db.execute(sql`
    ALTER TABLE notification 
    ADD COLUMN IF NOT EXISTS payload_hash VARCHAR(64)
  `);
  
  await db.execute(sql`
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_idempotency 
    ON notification(idempotency_key) 
    WHERE idempotency_key IS NOT NULL
  `);
}

export async function down(db: Database) {
  await db.execute(sql`DROP INDEX IF EXISTS idx_location_position_gist`);
  await db.execute(sql`ALTER TABLE location DROP CONSTRAINT IF EXISTS check_geofence_radius_range`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_notification_idempotency`);
  await db.execute(sql`ALTER TABLE notification DROP COLUMN IF EXISTS payload_hash`);
}
```

**Migration 002: Add Timezone Support**
```typescript
// migrations/002_add_timezone_support.ts

export async function up(db: Database) {
  // Add timezone columns
  await db.execute(sql`
    ALTER TABLE worker 
    ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC'
  `);
  
  await db.execute(sql`
    ALTER TABLE shift 
    ADD COLUMN IF NOT EXISTS timezone VARCHAR(50)
  `);
  
  // Migrate existing workers to organization timezone or UTC
  await db.execute(sql`
    UPDATE worker w
    SET timezone = COALESCE(o.timezone, 'UTC')
    FROM organization o
    WHERE w.organization_id = o.id
    AND w.timezone IS NULL
  `);
}

export async function down(db: Database) {
  await db.execute(sql`ALTER TABLE worker DROP COLUMN IF EXISTS timezone`);
  await db.execute(sql`ALTER TABLE shift DROP COLUMN IF EXISTS timezone`);
}
```

**Migration 003: Add Exclusion Constraint**
```typescript
// migrations/003_add_exclusion_constraint.ts

export async function up(db: Database) {
  // Enable btree_gist extension
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS btree_gist`);
  
  // Add exclusion constraint for shift overlaps
  await db.execute(sql`
    ALTER TABLE shift_assignment 
    ADD CONSTRAINT no_worker_overlap 
    EXCLUDE USING gist (
      worker_id WITH =,
      tsrange(scheduled_start, scheduled_end) WITH &&
    )
    WHERE (status != 'cancelled')
  `);
}

export async function down(db: Database) {
  await db.execute(sql`
    ALTER TABLE shift_assignment 
    DROP CONSTRAINT IF EXISTS no_worker_overlap
  `);
}
```


## Rollback Considerations

### Rollback Decision Matrix

| Bug Fix | Rollback Complexity | Data Loss Risk | Rollback Time | Notes |
|---------|-------------------|----------------|---------------|-------|
| RACE-001 | Low | None | < 5 min | Code-only change, no schema |
| RACE-002 | Medium | None | < 15 min | Drop constraint, revert code |
| RACE-003 | Low | None | < 5 min | Drop index, revert code |
| TENANT-001 | Low | None | < 5 min | Code-only change |
| TENANT-002 | Low | None | < 5 min | Code-only change |
| TENANT-003 | Low | None | < 5 min | Code-only change |
| GEO-001 | Low | None | < 5 min | Code-only change |
| GEO-002 | Low | None | < 10 min | Drop index (optional) |
| GEO-003 | Medium | None | < 15 min | Drop constraint, may need data fix |
| NOTIF-001 | Low | None | < 5 min | Code-only change |
| NOTIF-002 | Low | None | < 10 min | May need to reactivate tokens |
| NOTIF-004 | Low | None | < 5 min | Code-only change |

### Rollback Procedures

#### Immediate Rollback (Code-Only Changes)

For bugs with code-only fixes (RACE-001, TENANT-001/002/003, GEO-001, NOTIF-001/004):

```bash
# 1. Revert to previous deployment
git revert <commit-hash>
git push origin main

# 2. Deploy previous version
./deploy.sh production --version <previous-version>

# 3. Verify rollback
curl https://api.pavn.com/health
```

**Estimated Time**: 5 minutes

**Risk**: Minimal - no database changes to revert

#### Database Constraint Rollback (RACE-002, GEO-003)

For bugs with database constraints:

```sql
-- RACE-002: Remove exclusion constraint
ALTER TABLE shift_assignment DROP CONSTRAINT no_worker_overlap;

-- GEO-003: Remove CHECK constraint
ALTER TABLE location DROP CONSTRAINT check_geofence_radius_range;
```

Then revert application code as above.

**Estimated Time**: 15 minutes

**Risk**: Low - constraints can be re-added later without data loss

#### Index Rollback (RACE-003, GEO-002)

For bugs with index changes:

```sql
-- RACE-003: Remove idempotency index
DROP INDEX CONCURRENTLY idx_notification_idempotency;

-- GEO-002: Remove GIST index (optional - can keep for performance)
DROP INDEX CONCURRENTLY idx_location_position_gist;
```

**Estimated Time**: 10 minutes

**Risk**: Minimal - indexes don't affect data, only performance

#### Token Deduplication Rollback (NOTIF-002)

If token deduplication causes issues:

```sql
-- Reactivate tokens that were marked inactive during cleanup
UPDATE device_token
SET status = 'active',
    inactive_reason = NULL,
    inactive_at = NULL
WHERE inactive_reason = 'Duplicate token - kept most recent'
AND inactive_at > NOW() - INTERVAL '1 day';
```

Then revert application code.

**Estimated Time**: 10 minutes

**Risk**: Low - may result in duplicate notifications temporarily

### Rollback Triggers

**When to Rollback:**

1. **Critical Error Rate Increase**
   - Error rate > 5% for any endpoint
   - Database connection errors
   - Timeout errors > 1%

2. **Performance Degradation**
   - Response time p95 > 2x baseline
   - Database query time > 500ms p95
   - CPU usage > 80% sustained

3. **Data Integrity Issues**
   - Duplicate records detected
   - Cross-tenant data leaks
   - Constraint violations causing user-facing errors

4. **User Impact**
   - Clock-in success rate < 80%
   - Notification delivery rate < 90%
   - User complaints > 10 in 1 hour

**Rollback Decision Process:**

```
1. Detect issue via monitoring/alerts
   ↓
2. Assess severity (P0/P1/P2)
   ↓
3. If P0 (data leak, corruption): IMMEDIATE ROLLBACK
   ↓
4. If P1 (high error rate): Attempt quick fix (5 min), else ROLLBACK
   ↓
5. If P2 (performance): Monitor for 15 min, then decide
   ↓
6. Document rollback reason and plan forward fix
```

### Post-Rollback Actions

**Immediate (Within 1 hour):**
1. Verify system stability after rollback
2. Document root cause of rollback
3. Notify stakeholders
4. Preserve logs and metrics for analysis

**Short-term (Within 24 hours):**
1. Analyze root cause
2. Develop fix for the issue that caused rollback
3. Test fix in staging environment
4. Plan re-deployment with additional safeguards

**Long-term (Within 1 week):**
1. Conduct post-mortem
2. Update deployment procedures
3. Add additional monitoring/alerts
4. Re-deploy fixes with lessons learned

### Partial Rollback Strategy

If only specific fixes are problematic, use feature flags for partial rollback:

```typescript
// Feature flags for gradual rollout
const FEATURE_FLAGS = {
  ENABLE_OPTIMISTIC_LOCKING: true,
  ENABLE_GPS_ACCURACY_CHECK: true,
  ENABLE_TOKEN_DEDUPLICATION: true,
  ENABLE_TIMEZONE_QUIET_HOURS: true
};

// Example usage
async function clockOut(assignmentId: string) {
  if (FEATURE_FLAGS.ENABLE_OPTIMISTIC_LOCKING) {
    return clockOutWithOptimisticLocking(assignmentId);
  } else {
    return clockOutLegacy(assignmentId);
  }
}
```

This allows disabling specific fixes without full rollback.

### Data Backup and Recovery

**Pre-Deployment Backup:**

```bash
# Backup critical tables before deployment
pg_dump -h $DB_HOST -U $DB_USER -t shift_assignment -t location -t notification \
  --data-only --inserts > backup_$(date +%Y%m%d_%H%M%S).sql
```

**Recovery Procedure:**

```bash
# If data corruption detected, restore from backup
psql -h $DB_HOST -U $DB_USER -d $DB_NAME < backup_20240115_120000.sql
```

**Continuous Backup:**
- Point-in-time recovery enabled (PostgreSQL WAL archiving)
- Automated daily backups retained for 30 days
- Transaction logs retained for 7 days

### Communication Plan

**Rollback Communication Template:**

```
Subject: [INCIDENT] Production Rollback - Critical Bugs Fix

Status: RESOLVED
Severity: P1
Duration: [start time] - [end time]

Summary:
We rolled back the critical bugs fix deployment due to [specific issue].

Impact:
- [Describe user impact]
- [Affected features]

Resolution:
- Rolled back to version [previous version]
- System is stable and operating normally
- Original bugs remain unfixed temporarily

Next Steps:
- Root cause analysis in progress
- Fix will be re-deployed after additional testing
- ETA for re-deployment: [date/time]

Contact: [on-call engineer]
```

### Testing Before Re-Deployment

After rollback and fix, perform these tests before re-deploying:

1. **Regression Tests**: Run full test suite
2. **Load Tests**: Simulate production load
3. **Soak Tests**: Run for 24 hours in staging
4. **Canary Deployment**: Deploy to 5% of traffic first
5. **Gradual Rollout**: Increase to 25%, 50%, 100% over 24 hours


## Summary and Recommendations

### Implementation Priority

Based on severity, risk, and complexity, the recommended implementation order is:

**Priority 1 (Critical - Deploy Immediately):**
1. **TENANT-001, TENANT-002, TENANT-003**: Tenant isolation vulnerabilities pose immediate security risk
   - Risk: Cross-organization data leaks
   - Complexity: Low (code-only changes)
   - Estimated effort: 2-3 days

**Priority 2 (High - Deploy Within 1 Week):**
2. **RACE-001**: Duplicate clock-out can corrupt timesheet data
   - Risk: Data integrity issues affecting payroll
   - Complexity: Low (optimistic locking)
   - Estimated effort: 1-2 days

3. **RACE-002**: Double-booking workers causes operational chaos
   - Risk: Workers assigned to conflicting shifts
   - Complexity: Medium (database constraint)
   - Estimated effort: 2-3 days

**Priority 3 (Medium - Deploy Within 2 Weeks):**
4. **GEO-001**: GPS accuracy validation improves location verification
   - Risk: Workers clocking in from incorrect locations
   - Complexity: Low (validation logic)
   - Estimated effort: 1 day

5. **GEO-002**: Spatial index improves query performance
   - Risk: Slow geofence queries under load
   - Complexity: Low (database index)
   - Estimated effort: 1 day

6. **GEO-003**: Geofence radius constraints prevent invalid configurations
   - Risk: Invalid geofence settings breaking validation
   - Complexity: Medium (constraint + data cleanup)
   - Estimated effort: 1-2 days

**Priority 4 (Low - Deploy Within 1 Month):**
7. **RACE-003**: Notification idempotency prevents duplicates
   - Risk: Duplicate notifications (user annoyance)
   - Complexity: Low (unique constraint)
   - Estimated effort: 1-2 days

8. **NOTIF-001**: Token mapping ensures correct error attribution
   - Risk: Wrong tokens marked inactive
   - Complexity: Medium (refactor batch logic)
   - Estimated effort: 2-3 days

9. **NOTIF-002**: Token deduplication prevents duplicate notifications
   - Risk: Workers receive multiple notifications
   - Complexity: Low (deduplication logic)
   - Estimated effort: 1 day

10. **NOTIF-004**: Timezone-aware quiet hours respects user preferences
    - Risk: Notifications during local quiet hours
    - Complexity: Medium (timezone conversion)
    - Estimated effort: 2-3 days

### Total Estimated Effort

- **Development**: 15-20 days
- **Testing**: 5-7 days
- **Deployment**: 2-3 days (phased rollout)
- **Total**: 22-30 days (4-6 weeks)

### Key Success Metrics

**Security Metrics:**
- Zero cross-tenant data access attempts
- 100% authorization checks passing
- Zero unauthorized invitation creations

**Data Integrity Metrics:**
- Zero duplicate clock-out records
- Zero double-booked workers
- Zero duplicate notifications from same idempotency key

**Performance Metrics:**
- Geofence query p95 < 50ms (down from 200ms+)
- Clock-in success rate > 95%
- Notification delivery rate > 95%

**User Experience Metrics:**
- Clock-in rejection rate < 5% (due to GPS accuracy)
- Notification complaints < 1% of users
- Zero payroll discrepancies from clock-out issues

### Risk Mitigation

**High-Risk Changes:**
1. Exclusion constraint (RACE-002) - May reveal existing overlaps
   - Mitigation: Audit existing data first, clean up conflicts
   
2. GPS accuracy validation (GEO-001) - May increase clock-in failures
   - Mitigation: Start with warning-only mode, adjust threshold based on data

3. Timezone migration (NOTIF-004) - May affect existing quiet hours
   - Mitigation: Default to UTC, allow workers to update timezone

**Testing Recommendations:**
- Run exploratory tests on unfixed code to confirm bugs
- Use property-based testing for race conditions
- Test with real GPS data from mobile devices
- Test with workers in multiple timezones

**Monitoring Recommendations:**
- Add detailed logging for all fixes
- Set up alerts for error rate increases
- Monitor query performance continuously
- Track user-facing metrics (clock-in success, notification delivery)

### Backward Compatibility

All fixes maintain backward compatibility:
- Single-request operations work identically
- Same-tenant queries return same results
- Valid geofence operations unchanged
- Single-token notifications work as before

No breaking API changes required.

### Documentation Updates

**Required Documentation:**
1. API documentation for new error codes (conflict, forbidden)
2. Admin guide for geofence radius configuration
3. Worker guide for timezone settings
4. Developer guide for tenant-scoped queries
5. Runbook for monitoring and troubleshooting

### Long-Term Improvements

**Beyond This Fix:**
1. Implement row-level security (RLS) for defense-in-depth
2. Add automated tenant isolation testing in CI/CD
3. Implement distributed tracing for cross-service requests
4. Add chaos engineering tests for race conditions
5. Implement real-time monitoring dashboard for all metrics

### Conclusion

This design provides comprehensive solutions for all 12 critical bugs, prioritizing security (tenant isolation) and data integrity (race conditions) while improving performance (geofencing) and user experience (notifications). The phased deployment approach minimizes risk while allowing for validation at each stage. All fixes are designed to be backward compatible with clear rollback procedures.

The estimated 4-6 week timeline includes development, testing, and phased deployment. Priority 1 fixes (tenant isolation) should be deployed immediately due to security implications, while lower-priority fixes can follow in subsequent releases.

