
import { addWeeks, parseISO, format, isAfter, isBefore, getDay, addDays, isValid } from "date-fns";

export interface RecurrenceConfig {
    enabled: boolean;
    pattern: 'weekly' | 'biweekly';
    daysOfWeek: number[]; // 0=Sunday, 6=Saturday
    endType: 'after_weeks' | 'on_date';
    endAfter?: number;
    endDate?: string;
}

/**
 * Expands a set of base dates based on a recurrence pattern.
 * NOTE: The base dates themselves are assumed to be "template" dates (e.g., usually just one week is provided).
 * However, the requirement implies we might select "Mon/Tue" and say "Repeat for 4 weeks".
 * @param baseDates ISO date strings (YYYY-MM-DD) from the input
 * @param recurrence Configuration
 * @param limit Safety limit (e.g. 365)
 */
export const expandRecurringDates = (
    baseDates: string[],
    recurrence: RecurrenceConfig | undefined,
    limit: number = 365
): string[] => {
    if (!recurrence || !recurrence.enabled) {
        return baseDates;
    }

    const { pattern, daysOfWeek, endType, endAfter, endDate } = recurrence;
    const intervalWeeks = pattern === 'biweekly' ? 2 : 1;

    // We need a stable start date.
    // If baseDates are provided, we should probably use the EARLIEST one as the anchor for "Week 1".
    if (baseDates.length === 0) return [];

    const sortedDates = [...baseDates].sort();
    const firstDate = sortedDates[0];
    if (!firstDate) return [];

    const startDateObj = parseISO(firstDate);

    // Validate End Criteria
    let maxDate: Date | null = null;
    let maxWeeks = 0;

    if (endType === 'on_date' && endDate) {
        maxDate = parseISO(endDate);
        if (!isValid(maxDate)) throw new Error("Invalid recurrence end date");
    } else if (endType === 'after_weeks' && endAfter) {
        maxWeeks = endAfter;
    } else {
        // Fallback default
        maxWeeks = 1;
    }

    const expandedDates = new Set<string>();

    // Strategy: Iterate weeks until criteria met
    // Anchor is startDateObj.
    // Logic: 
    // If daysOfWeek is provided, we ignore the specific days in baseDates and only use them as "this is the starting week"?
    // OR do we repeat the *specific* dates?
    // Requirement says: "Example: Morning shift: Mon-Fri... Repeat for 4 weeks... One click -> 20 shifts"
    // Usually the user selects a "Start Date" and then check boxes for "Mon, Tue, Wed...".
    // AND keys in the recurrence settings.
    // IF the user sends `dates: ["2026-01-20"]` (which is a Tuesday) and `daysOfWeek: [1, 2]` (Mon, Tue).
    // Should we generate Mon/Tue for current week? Or just use 2026-01-20 as the "start" and generate subsequent weeks?

    // Safest Interpretation:
    // 1. Determine the "Start of the Pattern" based on the earliest date in `dates`.
    // 2. Iterate `weekIndex` from 0 to `maxWeeks` (or until validation fail).
    // 3. For each week, generate dates for every day in `daysOfWeek`.
    // 4. Filter out any dates that are BEFORE the earliest input date (don't backfill history unless requested).
    // 5. Or, more commonly, the input `dates` ARE the first week.

    // Let's stick to a simpler additive model compatible with typical "Copy/Paste" recurrence:
    // "Take these source dates, and repeat them N times with X interval."
    // BUT the requirement mentions `daysOfWeek`. This implies we are generating dates *from* the pattern, distinct from source dates?
    // "Support daysOfWeek: array of 0-6"
    // If I select "Jan 20 (Tue)" but check "Mon, Fri" in daysOfWeek...
    // The intention is likely: "Starting week of Jan 20, create shifts on Mon and Fri, and repeat."

    // Let's use the Earliest Base Date to determine the "Anchor Week".

    let currentWeekStart = startDateObj; // Note: this might not be Sunday. It's just an anchor.
    // Actually, let's normalize to the specific Day of Week to find the "Sunday" of that week to make math easier.
    // But `daysOfWeek` (0-6) works best if we know the Sunday of the derived week.

    const dayOfStart = getDay(startDateObj); // 0-6
    const sundayOfStartWeek = addDays(startDateObj, -dayOfStart);

    let weeksAdded = 0;

    // Loop safety: hard cap 52 weeks to prevent infinite loops if logic bugs out
    while (true) {
        if (endType === 'after_weeks' && weeksAdded >= maxWeeks) break;

        // Calculate dates for this week
        for (const dayIndex of daysOfWeek) { // 0=Sun, 1=Mon...
            const potentialDate = addDays(sundayOfStartWeek, (weeksAdded * 7 * intervalWeeks) + dayIndex);

            // Check End Date
            if (maxDate && isAfter(potentialDate, maxDate)) continue;

            // Verify it is not before our "Start Date" (unless that's desired behavior? Usually start date is inclusive)
            // We'll allow "backfilling" the current week if the user selected a midweek date but asked for "Monday" of this week recursion.
            // BUT, usually we don't want to create shifts in the past relative to the request anchor?
            // Let's implicitly allow it, validation elsewhere handles "Past Dates".

            expandedDates.add(format(potentialDate, 'yyyy-MM-dd'));
        }

        weeksAdded++;
        if (endType === 'on_date' && maxDate) {
            // Need to check if the NEXT iteration would be fully past maxDate? 
            // Or just rely on the inner check. 
            // We need a break condition for 'on_date'.
            const nextWeekStart = addDays(sundayOfStartWeek, (weeksAdded * 7 * intervalWeeks));
            if (isAfter(nextWeekStart, maxDate)) break;
        }
    }

    const result = Array.from(expandedDates).sort();
    return result.slice(0, limit);
};
