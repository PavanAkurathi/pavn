# Bugfix Requirements Document

## Introduction

This document addresses 12 critical security and data integrity issues discovered in the Pavn (WorkersHive) workforce management platform. These issues span race conditions in concurrent operations, tenant isolation vulnerabilities that could leak data across organizations, geofencing validation problems, and notification system bugs. The platform manages shift scheduling, worker clock-in/out operations, geofence verification, and push notifications across a multi-tenant architecture using PostgreSQL, Drizzle ORM, and Expo push notifications.

The bugs are categorized into four groups:
- **Race Conditions (RACE-001 to RACE-003)**: Concurrent operations causing data corruption
- **Tenant Isolation (TENANT-001 to TENANT-003)**: Cross-organization data leaks
- **Geofencing (GEO-001 to GEO-003)**: Location validation and performance issues
- **Notifications (NOTIF-001, NOTIF-002, NOTIF-004)**: Token mapping and timezone handling bugs

## Bug Analysis

### Current Behavior (Defect)

#### Race Conditions

1.1 WHEN two concurrent requests attempt to clock out the same shift assignment THEN the system performs a SELECT to check clock-out status followed by an UPDATE, allowing both requests to pass the check and execute the UPDATE, resulting in duplicate clock-out records or inconsistent timesheet data

1.2 WHEN multiple shift publishing requests check for worker availability overlaps before inserting assignments THEN the system performs overlap validation queries followed by batch inserts, allowing concurrent requests to pass validation checks simultaneously and insert conflicting assignments that double-book workers

1.3 WHEN duplicate notification scheduling requests arrive with the same idempotency key but different payload hashes THEN the system creates multiple notification records instead of detecting the collision, resulting in workers receiving duplicate shift notifications

#### Tenant Isolation Vulnerabilities

1.4 WHEN the shift publishing service queries worker availability in `publish.ts` line 219 THEN the system fetches availability records without filtering by organizationId, potentially exposing worker availability data from other organizations

1.5 WHEN location ingestion queries worker location data in `ingest-location.ts` lines 50-70 THEN the system queries workerLocation and shiftAssignment tables without consistently filtering by organizationId, allowing potential cross-tenant data access

1.6 WHEN a user creates an invitation token in `auth.ts` lines 160-180 THEN the system validates the token exists but does not verify that the inviter is an admin of the target organization, allowing malicious users to create invites for organizations they don't belong to

#### Geofencing Issues

1.7 WHEN a worker attempts to clock in with GPS accuracy of 200 meters in `clock-in.ts` lines 35-40 THEN the system accepts the location data, allowing workers to clock in from outside the actual building despite being far from the precise location

1.8 WHEN geofence queries execute ST_DWithin operations in `clock-in.ts` lines 60-75 THEN the system uses B-Tree indexes instead of GIST indexes for spatial queries on the position column, causing slow query performance and potential timeouts under load

1.9 WHEN an admin sets a geofence radius in the location table THEN the system accepts any integer value without min/max constraints, allowing invalid values like 0 meters or 10000 meters that break geofence validation logic

#### Notification System Issues

1.10 WHEN batch notifications are sent in `expo-push.ts` lines 70-80 THEN the system filters tokens and chunks messages, but the token-to-message mapping becomes unreliable after filtering, causing wrong tokens to be marked inactive and errors to be misattributed to incorrect devices

1.11 WHEN a worker has multiple device tokens registered and receives a notification THEN the system sends the same notification to all tokens without deduplication, causing workers to receive duplicate notifications on the same device if tokens were registered multiple times

1.12 WHEN quiet hours logic checks notification scheduling time in `scheduler.ts` lines 180-200 THEN the system compares against server time using JavaScript Date methods without accounting for worker timezone, causing workers in different timezones to receive notifications during their local quiet hours

### Expected Behavior (Correct)

#### Race Conditions

2.1 WHEN two concurrent requests attempt to clock out the same shift assignment THEN the system SHALL use database-level concurrency control (SELECT FOR UPDATE or optimistic locking with WHERE clause guards) to ensure only one request successfully updates the assignment, with the second request receiving a clear error indicating the assignment was already clocked out

2.2 WHEN multiple shift publishing requests check for worker availability overlaps before inserting assignments THEN the system SHALL use serializable transaction isolation or database constraints (unique index on workerId + time range) to prevent double-booking, ensuring that if concurrent requests attempt to assign the same worker to overlapping shifts, only one succeeds and others receive a conflict error

2.3 WHEN duplicate notification scheduling requests arrive with the same idempotency key THEN the system SHALL check both the idempotency key AND payload hash atomically within a transaction, returning the cached response for identical requests and rejecting requests with mismatched payloads before any notification records are created

#### Tenant Isolation Vulnerabilities

2.4 WHEN the shift publishing service queries worker availability in `publish.ts` THEN the system SHALL include organizationId filter in the workerAvailability query to ensure availability data is scoped to the requesting organization only

2.5 WHEN location ingestion queries worker location data in `ingest-location.ts` THEN the system SHALL consistently filter all workerLocation and shiftAssignment queries by organizationId to prevent cross-tenant data access

2.6 WHEN a user creates an invitation token in `auth.ts` THEN the system SHALL verify that the inviter (inviterId) has an active admin membership in the target organizationId before creating the invitation, rejecting requests where the inviter is not an admin of that organization

#### Geofencing Issues

2.7 WHEN a worker attempts to clock in with GPS accuracy data in `clock-in.ts` THEN the system SHALL reject location data with accuracy greater than 50 meters (or configurable threshold significantly lower than 200m) to ensure workers are precisely at the venue location

2.8 WHEN geofence queries execute ST_DWithin operations in `clock-in.ts` THEN the system SHALL use GIST indexes on the position column (or migrate to PostGIS geography type with proper spatial indexes) to optimize spatial query performance and prevent timeouts under load

2.9 WHEN an admin sets a geofence radius in the location table THEN the system SHALL enforce database-level constraints (CHECK constraint) ensuring geofenceRadius is between 10 and 500 meters, preventing invalid values that break geofence logic

#### Notification System Issues

2.10 WHEN batch notifications are sent in `expo-push.ts` THEN the system SHALL maintain an explicit mapping between each message and its source token/notification ID throughout the chunking and filtering process, ensuring that delivery results and errors are attributed to the correct device token

2.11 WHEN a worker has multiple device tokens registered and receives a notification THEN the system SHALL deduplicate tokens by pushToken value before sending, ensuring each unique device receives the notification exactly once regardless of duplicate registrations

2.12 WHEN quiet hours logic checks notification scheduling time in `scheduler.ts` THEN the system SHALL convert the scheduled notification time to the worker's timezone (from shift or user preferences) before comparing against quiet hours start/end times, ensuring quiet hours are respected in the worker's local time

### Unchanged Behavior (Regression Prevention)

#### Race Conditions

3.1 WHEN a single request clocks out a shift assignment without concurrent conflicts THEN the system SHALL CONTINUE TO successfully update the assignment with actualClockOut, effectiveClockOut, and status='completed', recording the clock-out time and updating shift status if all assignments are complete

3.2 WHEN shift publishing requests process non-overlapping shifts for different workers THEN the system SHALL CONTINUE TO successfully create shifts and assignments in batch, maintaining the current performance characteristics for non-conflicting operations

3.3 WHEN notification scheduling requests use unique idempotency keys with matching payloads THEN the system SHALL CONTINUE TO return cached responses without creating duplicate notifications, maintaining the current idempotency behavior for valid requests

#### Tenant Isolation Vulnerabilities

3.4 WHEN the shift publishing service queries worker availability for workers within the same organization THEN the system SHALL CONTINUE TO correctly identify availability conflicts and prevent scheduling during unavailable periods for workers in that organization

3.5 WHEN location ingestion processes location pings for workers with active shifts in their organization THEN the system SHALL CONTINUE TO correctly calculate distances, detect arrivals/departures, and trigger appropriate notifications for same-organization operations

3.6 WHEN a valid admin creates invitation tokens for their own organization THEN the system SHALL CONTINUE TO successfully create invitations that workers can use to join the organization, maintaining the current invitation flow for legitimate use cases

#### Geofencing Issues

3.7 WHEN a worker clocks in with GPS accuracy better than the new threshold (e.g., 30 meters) and within the geofence radius THEN the system SHALL CONTINUE TO successfully verify the location and record the clock-in with clockInVerified=true

3.8 WHEN geofence queries execute with proper spatial indexes THEN the system SHALL CONTINUE TO return correct distance calculations and isWithin boolean results, maintaining the current geofence validation logic

3.9 WHEN an admin sets a valid geofence radius (e.g., 100 meters) within the acceptable range THEN the system SHALL CONTINUE TO store and use that radius for all geofence validation operations without errors

#### Notification System Issues

3.10 WHEN batch notifications are sent to workers with single active device tokens THEN the system SHALL CONTINUE TO successfully deliver notifications and correctly mark them as sent, maintaining current delivery success rates for non-problematic token configurations

3.11 WHEN a worker has a single unique device token registered THEN the system SHALL CONTINUE TO receive notifications exactly once, maintaining the current notification delivery behavior for properly configured devices

3.12 WHEN quiet hours are disabled for a worker (quietHoursEnabled=false) THEN the system SHALL CONTINUE TO send all scheduled notifications regardless of time, maintaining the current behavior for workers who have not enabled quiet hours
