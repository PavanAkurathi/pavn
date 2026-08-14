/**
 * Shift times belong to the place the shift happens, not to whoever is looking.
 *
 * A manager in Boston scheduling a Seattle site must see the Seattle clock, or
 * they will book a 9am shift that starts at 6am for the worker. These helpers
 * take the zone explicitly so that never happens by accident; when a shift has
 * no zone recorded, the caller is told (`isViewerZone`) rather than silently
 * getting their own.
 */

export type ShiftClock = {
    /** e.g. "9:00 AM" */
    start: string;
    /** e.g. "5:00 PM" */
    end: string;
    /** e.g. "PDT" — the zone the times above are in. */
    zoneLabel: string | undefined;
    /** True when we fell back to the viewer's clock because none was recorded. */
    isViewerZone: boolean;
};

function formatTime(date: Date, timeZone?: string) {
    return new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
        ...(timeZone ? { timeZone } : {}),
    }).format(date);
}

function zoneAbbreviation(date: Date, timeZone?: string) {
    return new Intl.DateTimeFormat(undefined, {
        timeZoneName: "short",
        ...(timeZone ? { timeZone } : {}),
    })
        .formatToParts(date)
        .find((part) => part.type === "timeZoneName")?.value;
}

/** Returns true when the given zone renders the same wall time as the viewer's. */
export function zoneMatchesViewer(date: Date, timeZone?: string | null) {
    if (!timeZone) return true;
    return formatTime(date, timeZone) === formatTime(date);
}

export function getShiftClock(
    start: Date,
    end: Date,
    timeZone?: string | null,
): ShiftClock {
    const zone = timeZone || undefined;

    try {
        return {
            start: formatTime(start, zone),
            end: formatTime(end, zone),
            zoneLabel: zoneAbbreviation(start, zone),
            isViewerZone: !zone,
        };
    } catch {
        // An unrecognised IANA name should not blank the schedule.
        return {
            start: formatTime(start),
            end: formatTime(end),
            zoneLabel: zoneAbbreviation(start),
            isViewerZone: true,
        };
    }
}
