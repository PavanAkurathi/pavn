
// packages/shifts/src/db/mock-db.ts

import { Shift, TimesheetWorker } from '../types';
import { MOCK_SHIFTS as ORIGINAL_SHIFTS, MOCK_TIMESHEETS as ORIGINAL_TIMESHEETS } from '../mock-data';

// Re-exporting for now, but in a real DB scenario this would be the connection logic
export const db = {
    shifts: ORIGINAL_SHIFTS,
    timesheets: ORIGINAL_TIMESHEETS,
};
