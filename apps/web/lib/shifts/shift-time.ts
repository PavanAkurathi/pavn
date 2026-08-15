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

/**
 * The wall clock at the site, as an edit form needs it: "2026-08-20", "09:00".
 *
 * Editing a shift means editing the time it starts *there*. Reading the form's
 * initial values off the viewer's clock would silently shift the shift the
 * moment a manager in another zone opened the dialog and saved without
 * touching anything.
 */
export function getLocalParts(date: Date, timeZone?: string | null) {
    const opts: Intl.DateTimeFormatOptions = timeZone ? { timeZone } : {};

    // Read by part type rather than position — the order differs by locale, and
    // an off-by-one here would silently move the shift to another day.
    const parts = new Intl.DateTimeFormat("en-GB", {
        ...opts,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);

    const partOf = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((part) => part.type === type)?.value ?? "";
    const year = partOf("year");
    const month = partOf("month");
    const day = partOf("day");

    const time = new Intl.DateTimeFormat("en-GB", {
        ...opts,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(date);

    return { date: `${year}-${month}-${day}`, time };
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
