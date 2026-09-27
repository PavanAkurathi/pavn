import { sql } from "drizzle-orm";
import { shiftAssignment } from "./schema";

/**
 * Staff see the published schedule. A person a manager has staged onto a
 * published shift (pending_state = 'add') isn't on it until the week is
 * published; someone staged to come off ('remove') still is. Every read made
 * for a worker, and every clock-in check, goes through this.
 */
export const visibleToStaff = () => sql`${shiftAssignment.pendingState} is distinct from 'add'`;
