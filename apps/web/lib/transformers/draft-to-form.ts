import { Shift } from "@repo/shifts-service";
import { FormValues } from "../../components/schedule/create-schedule-form";
import { format, parseISO } from "date-fns";

export function transformDraftsToForm(drafts: Shift[]): FormValues | undefined {
    if (!drafts || !drafts.length) return undefined;

    // 1. Group by ScheduleGroupId (Layout Intent)
    const groups: { [key: string]: Shift[] } = {};
    drafts.forEach(s => {
        const key = (s as any).scheduleGroupId || 'legacy_draft';
        if (!groups[key]) groups[key] = [];
        groups[key].push(s);
    });

    const schedules: FormValues['schedules'] = [];
    const managerIds = new Set<string>();
    let locationId = "";

    // Iterate through groups
    Object.values(groups).forEach(groupShifts => {
        if (!groupShifts || groupShifts.length === 0) return;

        // Safety check: ensure first element exists
        const first = groupShifts[0];
        if (!first) return;

        // Global Form Fields (Take from first valid shift)
        if (!locationId && first.locationId) locationId = first.locationId;

        groupShifts.forEach(s => {
            if (s.contactId) managerIds.add(s.contactId);
        });

        // 2. Schedule Block Details
        const scheduleName = first.description || "Draft Schedule";

        // Time Normalization
        let startTimeStr = "09:00";
        let endTimeStr = "17:00";

        if (first.startTime && first.endTime) {
            try {
                const start = parseISO(first.startTime);
                const end = parseISO(first.endTime);
                startTimeStr = format(start, "HH:mm");
                endTimeStr = format(end, "HH:mm");
            } catch (e) {
                console.error("Failed to parse shift times", e);
            }
        }

        // Collect Unique Dates
        const uniqueDates = new Set<string>();
        // Group by Role for Positions
        const roleMap: { [role: string]: Shift[] } = {};

        groupShifts.forEach(s => {
            if (s.startTime) {
                uniqueDates.add(format(parseISO(s.startTime), "yyyy-MM-dd"));
            }

            const role = s.title || "Unknown Role";
            if (!roleMap[role]) roleMap[role] = [];
            roleMap[role].push(s);
        });

        Array.from(uniqueDates).forEach(dateStr => {
            const shiftsOnDate = groupShifts.filter(s =>
                s.startTime && format(parseISO(s.startTime), "yyyy-MM-dd") === dateStr
            );

            const firstShift = shiftsOnDate[0];
            if (!shiftsOnDate.length || !firstShift) return;

            // Re-build positions for THIS date
            const positions = Object.keys(roleMap).map(role => {
                const group = roleMap[role];
                if (!group) return null;

                const roleShifts = group.filter(s =>
                    s.startTime && format(parseISO(s.startTime), "yyyy-MM-dd") === dateStr
                );
                if (!roleShifts.length) return null;

                return roleShifts.map(s => {
                    const worker = s.assignedWorkers && s.assignedWorkers.length > 0 ? s.assignedWorkers[0] : null;
                    return {
                        roleId: "role_draft_" + role, // Dummy ID
                        roleName: role,
                        workerId: worker?.id || null,
                        workerName: worker?.name,
                        workerAvatar: worker?.avatarUrl,
                        workerInitials: worker?.initials,
                    };
                });
            }).filter(Boolean).flat();

            schedules.push({
                scheduleName: scheduleName,
                dates: [new Date(dateStr + "T00:00:00")],
                startTime: startTimeStr,
                endTime: endTimeStr,
                breakDuration: "0",
                positions: positions as any
            });
        });
    });

    return {
        locationId: locationId || "",
        managerIds: Array.from(managerIds),
        schedules: schedules
    };
}
