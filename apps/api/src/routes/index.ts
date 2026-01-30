/**
 * @fileoverview Route Module Exports
 * @module apps/api/routes
 * 
 * Re-exports all route modules for convenient importing.
 * Each router handles a specific domain of the application.
 * 
 * Available Routers:
 * - shiftsRouter: Shift scheduling and management
 * - workerRouter: Worker-facing endpoints
 * - timesheetsRouter: Timesheet reports and exports
 * - billingRouter: Billing and payment management
 * - organizationsRouter: Crew and location management
 * - geofenceRouter: Clock in/out and corrections
 * 
 * @example
 * import { shiftsRouter, workerRouter } from "./routes";
 * app.route("/shifts", shiftsRouter);
 * 
 * @author WorkersHive Team
 * @since 1.0.0
 */

export { shiftsRouter } from "./shifts";
export { workerRouter } from "./worker";
export { timesheetsRouter } from "./timesheets";
export { billingRouter } from "./billing";
export { organizationsRouter } from "./organizations";
export { geofenceRouter } from "./geofence";
