// packages/shifts/src/index.ts
// Shifts Package - Business Logic Library (NO SERVER)

// =============================================================================
// TYPES
// =============================================================================
export type { Shift, ShiftStatus, TimesheetWorker } from "./types";
export * from "./schemas";

// =============================================================================
// SERVICES (Business Logic)
// =============================================================================

// Shift listing
export { getUpcomingShifts } from "./services/upcoming";
export { getPendingShifts } from "./services/pending";
export { getHistoryShifts } from "./services/history";
export { getDraftShifts } from "./services/drafts";
export { deleteDrafts } from "./services/delete-drafts";

// Single shift operations
export { getShiftById } from "./services/get-by-id";
export { getShiftGroup } from "./services/get-shift-group";
export { approveShift } from "./services/approve";
export { cancelShift } from "./services/cancel";
export { assignWorker } from "./services/assign";

// Timesheets
export { getShiftTimesheets } from "./services/get-timesheets";
export { updateTimesheet } from "./services/update-timesheet";
export { getTimesheetsReport } from "./services/get-timesheets-report";
export { getReportFilters } from "./services/get-report-filters";
export { exportTimesheets } from "./services/export-timesheets";

// Publishing
export { publishSchedule } from "./services/publish";

// Crew & Organization
export { getCrew } from "./services/get-crew";
export { createLocation } from "./services/create-location";

// Availability
export { getAvailability } from "./services/get-availability";
export { setAvailability } from "./services/set-availability";

// Worker shifts
export { getWorkerShifts } from "./services/worker-shifts";

// Organization & Locations
export { getLocations } from "./services/get-locations";
export { updateLocation } from "./services/update-location";
export { deleteLocation } from "./services/delete-location";

// Worker Management
export { inviteWorker } from "./services/invite-worker";
export { updateWorker } from "./services/update-worker";
export { deactivateWorker } from "./services/deactivate-worker";
export { reactivateWorker } from "./services/reactivate-worker";

// Settings
export { getSettings } from "./services/get-settings";
export { updateSettings } from "./services/update-settings";

// =============================================================================
// CONSTANTS
// =============================================================================
export const AVAILABLE_LOCATIONS = [
    { id: "loc-1", name: "Main Office", address: "123 Main St" },
    { id: "loc-2", name: "Downtown Branch", address: "456 Downtown Ave" },
    { id: "loc-3", name: "Airport Hub", address: "789 Airport Rd" }
];
