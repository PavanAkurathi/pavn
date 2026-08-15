// packages/scheduling-timekeeping/src/modules/time-tracking/get-timesheets.ts

import { db } from "@repo/database";
import { shift, shiftAssignment, assignmentAuditEvent, user } from "@repo/database/schema";
import { eq, and, ne, inArray, desc } from "drizzle-orm";
import { TimesheetWorker } from "../../types";
import { getInitials } from "../../utils/formatting";
import { AppError } from "@repo/observability";
import { reconcileOverdueShiftState } from "./reconcile-overdue-shifts";

export const getShiftTimesheets = async (shiftId: string, orgId: string) => {
    await reconcileOverdueShiftState(orgId);

    // 1. Verify Shift Ownership
    const validShift = await db.query.shift.findFirst({
        where: and(eq(shift.id, shiftId), eq(shift.organizationId, orgId)),
        columns: { id: true, title: true }
    });

    if (!validShift) {
        throw new AppError("Shift not found", "SHIFT_NOT_FOUND", 404);
    }

    // 2. Query DB with inference
    const assignments = await db.query.shiftAssignment.findMany({
        where: and(
            eq(shiftAssignment.shiftId, shiftId),
            ne(shiftAssignment.status, "removed"),
        ),
        with: {
            worker: true,
            tempWorker: true,
            rosterEntry: true
        }
    });

    const visibleAssignments = assignments.filter((assignment) => assignment.status !== "removed");

    // The most recent hand edit per assignment, with the name of whoever made
    // it. A manager can change anything; this is what stops the change being
    // silent.
    const editsByAssignment = new Map<string, TimesheetWorker["edited"]>();
    const assignmentIds = visibleAssignments.map((a) => a.id);

    if (assignmentIds.length > 0) {
        const events = await db
            .select({
                assignmentId: assignmentAuditEvent.assignmentId,
                actorId: assignmentAuditEvent.actorId,
                actorName: user.name,
                metadata: assignmentAuditEvent.metadata,
                timestamp: assignmentAuditEvent.timestamp,
            })
            .from(assignmentAuditEvent)
            .leftJoin(user, eq(user.id, assignmentAuditEvent.actorId))
            .where(inArray(assignmentAuditEvent.assignmentId, assignmentIds))
            .orderBy(desc(assignmentAuditEvent.timestamp));

        for (const event of events) {
            // Ordered newest first, so the first one seen for an assignment wins.
            if (editsByAssignment.has(event.assignmentId)) continue;

            const meta = (event.metadata ?? {}) as Record<string, unknown>;
            const action = meta.action;
            if (action !== "manager_override" && action !== "timesheet_update") continue;

            editsByAssignment.set(event.assignmentId, {
                by: event.actorName ?? "A manager",
                at: event.timestamp.toISOString(),
                previousClockIn: (meta.previousClockIn as string | null) ?? undefined,
                previousClockOut: (meta.previousClockOut as string | null) ?? undefined,
                previousBreakMinutes: (meta.previousBreakMinutes as number | null) ?? undefined,
            });
        }
    }

    const timesheets: TimesheetWorker[] = visibleAssignments.map(a => {
        const isTemp = !!a.tempWorkerId;
        const isPendingInvite = !!a.rosterEntryId;
        // Fallback name if worker relation is missing (deleted user?)
        const workerName = isTemp
            ? (a.tempWorker?.name ?? "Temp worker")
            : isPendingInvite
                ? (a.rosterEntry?.name ?? "Invited worker")
                : (a.worker ? a.worker.name : "Unknown Worker");

        return {
            id: a.id,
            workerId: (a.workerId ?? a.tempWorkerId ?? a.rosterEntryId)!,
            isTemp,
            invitePending: isPendingInvite || undefined,
            agency: a.tempWorker?.agency ?? undefined,
            phone: (isTemp ? a.tempWorker?.phone : isPendingInvite ? a.rosterEntry?.phoneNumber : a.worker?.phoneNumber) ?? undefined,
            name: workerName,
            avatarUrl: a.worker?.image || undefined,
            avatarInitials: getInitials(workerName),
            role: validShift.title,
            // hourlyRate: 0,  // REMOVED per TICKET-005/008
            clockIn: (a.effectiveClockIn || a.actualClockIn) ? (a.effectiveClockIn || a.actualClockIn)!.toISOString() : undefined,
            clockOut: (a.effectiveClockOut || a.actualClockOut) ? (a.effectiveClockOut || a.actualClockOut)!.toISOString() : undefined,
            breakMinutes: a.breakMinutes || 0,
            status: mapAssignmentStatus(a.status as string),
            edited: editsByAssignment.get(a.id),
        };
    });

    return timesheets;
};

function mapAssignmentStatus(status: string): TimesheetWorker['status'] {
    // Validate against known UI types: 'rostered' | 'new' | 'blocked' | 'submitted' | 'approved'
    // Mapping:
    switch (status) {
        case 'active':
        case 'assigned':
            return 'rostered';
        case 'completed':
            return 'submitted';
        case 'approved':
            return 'approved';
        case 'cancelled':
            return 'cancelled';
        case 'no_show':
            return 'no-show';
        case 'removed':
            return 'cancelled';
        default:
            console.warn(`[TIMESHEET] Unknown assignment status: "${status}"`);
            return 'rostered';
    }
}
