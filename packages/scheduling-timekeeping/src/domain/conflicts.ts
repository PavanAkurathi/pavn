// packages/scheduling-timekeeping/src/domain/conflicts.ts

import type { ConflictWarning } from "@repo/contracts/scheduler";
import { compactHours } from "./labels";

/**
 * The one place that decides whether a person can take a shift.
 *
 * Every scheduler action asks the same question (create, move, assign, copy,
 * publish, claim, swap), and the old endpoints each answered it differently.
 * This function answers it once, from plain data, so the grid, the side panel
 * and the server all agree.
 *
 * Nothing here stops a draft from being saved. `block` means the person should
 * not work it as things stand; publishing or assigning one takes an explicit
 * "schedule anyway".
 */

export interface ConflictCandidate {
    /** Set when checking an existing shift, so it is not compared with itself. */
    shiftId?: string;
    start: Date;
    end: Date;
    role: string;
}

export interface ConflictContext {
    personRoles: string[];
    /** The person's other live assignments, at any location, not removed or cancelled. */
    otherShifts: Array<{ shiftId: string; start: Date; end: Date; label: string }>;
    timeOff: Array<{ start: Date; end: Date; status: "approved" | "pending"; label: string }>;
    unavailable: Array<{ start: Date; end: Date; label: string }>;
    /** Overtime this shift would add, from `addedOvertimeMinutes`; 0 when none. */
    addedOvertimeMinutes: number;
}

/** Back-to-back shifts (one ends as the next starts) do not overlap. */
export function overlaps(a: { start: Date; end: Date }, b: { start: Date; end: Date }): boolean {
    return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

const normalizeRole = (role: string) => role.trim().toLowerCase();

export function evaluateConflicts(candidate: ConflictCandidate, context: ConflictContext): ConflictWarning[] {
    const warnings: ConflictWarning[] = [];

    for (const other of context.otherShifts) {
        if (candidate.shiftId && other.shiftId === candidate.shiftId) continue;
        if (overlaps(candidate, other)) {
            warnings.push({ type: "overlap", severity: "block", message: `Already on ${other.label}` });
        }
    }

    for (const off of context.timeOff) {
        if (!overlaps(candidate, off)) continue;
        warnings.push(
            off.status === "approved"
                ? { type: "time_off", severity: "block", message: `On approved time off ${off.label}` }
                : { type: "time_off_requested", severity: "warn", message: `Asked for time off ${off.label}` },
        );
    }

    for (const window of context.unavailable) {
        if (overlaps(candidate, window)) {
            warnings.push({ type: "unavailable", severity: "warn", message: `Unavailable ${window.label}` });
        }
    }

    if (context.addedOvertimeMinutes > 0) {
        warnings.push({
            type: "overtime",
            severity: "warn",
            message: `Adds ${compactHours(context.addedOvertimeMinutes)} of overtime`,
        });
    }

    const roles = new Set(context.personRoles.map(normalizeRole));
    if (candidate.role && !roles.has(normalizeRole(candidate.role))) {
        warnings.push({ type: "role_mismatch", severity: "warn", message: `Not set up as ${candidate.role}` });
    }

    return warnings;
}

export const hasBlockingConflict = (warnings: ConflictWarning[]) =>
    warnings.some((warning) => warning.severity === "block");
