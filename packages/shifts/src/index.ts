// packages/shifts/src/index.ts
// Shifts Package - Business Logic Library (NO SERVER)

// =============================================================================
// TYPES
// =============================================================================
export type { Shift, ShiftStatus, TimesheetWorker } from "./types";
export * from "./schemas";

// =============================================================================
// CONTROLLERS (Business Logic)
// =============================================================================

// Shift listing
export { getUpcomingShifts } from "./controllers/upcoming";
export { getPendingShifts } from "./controllers/pending";
export { getHistoryShifts } from "./controllers/history";
export { getDraftShifts } from "./controllers/drafts";
export { deleteDraftsController } from "./controllers/delete-drafts";

// Single shift operations
export { getShiftByIdController } from "./controllers/get-by-id";
export { getShiftGroupController } from "./controllers/get-shift-group";
export { approveShiftController } from "./controllers/approve";
export { cancelShiftController } from "./controllers/cancel";
export { assignWorkerController } from "./controllers/assign";

// Timesheets
export { getShiftTimesheetsController } from "./controllers/get-timesheets";
export { updateTimesheetController } from "./controllers/update-timesheet";
export { getTimesheetsReportController } from "./controllers/get-timesheets-report";
export { getReportFiltersController } from "./controllers/get-report-filters";
export { exportTimesheetsController } from "./controllers/export-timesheets";

// Publishing
export { publishScheduleController } from "./controllers/publish";

// Crew & Organization
export { getCrewController } from "./controllers/get-crew";
export { createLocationController } from "./controllers/create-location";

// Availability
export { getAvailabilityController } from "./controllers/get-availability";
export { setAvailabilityController } from "./controllers/set-availability";

// Worker shifts
export { getWorkerShiftsController } from "./controllers/worker-shifts";

// Organization & Locations
export { getLocationsController } from "./controllers/get-locations";
export { updateLocationController } from "./controllers/update-location";
export { deleteLocationController } from "./controllers/delete-location";

// Worker Management
export { inviteWorkerController } from "./controllers/invite-worker";
export { updateWorkerController } from "./controllers/update-worker";
export { deactivateWorkerController } from "./controllers/deactivate-worker";
export { reactivateWorkerController } from "./controllers/reactivate-worker";

// Settings
export { getSettingsController } from "./controllers/get-settings";
export { updateSettingsController } from "./controllers/update-settings";

// =============================================================================
// CONSTANTS
// =============================================================================
export const AVAILABLE_LOCATIONS = [
    { id: "loc-1", name: "Main Office", address: "123 Main St" },
    { id: "loc-2", name: "Downtown Branch", address: "456 Downtown Ave" },
    { id: "loc-3", name: "Airport Hub", address: "789 Airport Rd" }
];
