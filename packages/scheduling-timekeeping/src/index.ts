export * from "./types";
export * from "./schemas";
export { publishSchedule } from "./modules/shifts/publish";
export { publishDrafts } from "./modules/shifts/publish-drafts";
export { getDraftShifts } from "./modules/shifts/drafts";
export { getUpcomingShifts } from "./modules/shifts/upcoming";
export { getHistoryShifts } from "./modules/shifts/history";
export { getShiftById } from "./modules/shifts/get-by-id";
export { cancelShift } from "./modules/shifts/cancel";
export { deleteDrafts } from "./modules/shifts/delete-drafts";
export { getShiftGroup } from "./modules/shifts/get-shift-group";
export { getPendingShifts } from "./modules/shifts/pending";
export { editShift } from "./modules/shifts/edit-shift";
export { duplicateShift } from "./modules/shifts/duplicate-shift";
export { getOpenShifts } from "./modules/shifts/open-shifts";

export { approveShift } from "./modules/time-tracking/approve";
export { assignWorker } from "./modules/time-tracking/assign";
export { getWorkerShifts } from "./modules/time-tracking/worker-shifts";
export { getWorkerShiftById } from "./modules/time-tracking/worker-shifts";
export { getShiftTimesheets } from "./modules/time-tracking/get-timesheets";
export { updateTimesheet } from "./modules/time-tracking/update-timesheet";
export { unassignWorker } from "./modules/time-tracking/unassign-worker";
export { listTempWorkers, createTempWorkers, renameTempWorker } from "./modules/time-tracking/temp-workers";
export { getWorkerAllShifts } from "./modules/time-tracking/worker-all-shifts";

export { exportTimesheets } from "./modules/reporting/export-timesheets";
export { getTimesheetsReport } from "./modules/reporting/get-timesheets-report";
export { getReportFilters } from "./modules/reporting/get-report-filters";
export { copyWeek } from "./modules/shifts/copy-week";
export {
    createShiftTemplate,
    createTemplateFromShift,
    listShiftTemplates,
    deleteShiftTemplate,
    applyShiftTemplate,
} from "./modules/shifts/templates";

// Scheduler (manager's weekly grid) and the rules it shares with every
// scheduling action.
export { getSchedulerWeek } from "./modules/scheduler/get-week";
export {
    applySchedulingSetup,
    canonicalDepartmentRoles,
    createDepartment,
    deleteDepartment,
    getSchedulingSettings,
    listDepartments,
    updateDepartment,
    updateSchedulingSettings,
} from "./modules/scheduler/settings";
export type { GetSchedulerWeekInput } from "./modules/scheduler/get-week";
export { evaluateConflicts, hasBlockingConflict, overlaps } from "./domain/conflicts";
export type { ConflictCandidate, ConflictContext } from "./domain/conflicts";
export { summarizeWeek, addedOvertimeMinutes, paidMinutes, WEEKLY_OVERTIME_THRESHOLD_MINUTES } from "./domain/hours";
export type { OvertimePolicy, WorkInterval, WeekHours } from "./domain/hours";
export { startOfLocalWeek, weekBounds, weekDates, dayIndexOf, splitIntoDaySpans, isLocalDate } from "./domain/week";
