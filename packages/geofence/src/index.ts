// packages/geofence/src/index.ts
// Geofence Package - Business Logic Library (NO SERVER)

// =============================================================================
// SERVICES
// =============================================================================

// Clock In/Out
export { clockIn } from "./services/clock-in";
export { clockOut } from "./services/clock-out";

// Correction Requests
export { requestCorrection } from "./services/request-correction";
export { getPendingCorrections, reviewCorrection } from "./services/review-correction";

// Manager Operations
export { managerOverride } from "./services/manager-override";
export { getFlaggedTimesheets } from "./services/flagged-timesheets";
export { getWorkerCorrections } from "./services/get-worker-corrections";

// Export schemas for OpenAPI
export * from "./schemas";

// Location
export { geocodeLocation, geocodeAllLocations } from "./services/geocode-location";
export { ingestLocation } from "./services/ingest-location";

// =============================================================================
// UTILITIES
// =============================================================================
export * from "./utils/geocode";
export * from "./utils/distance";
