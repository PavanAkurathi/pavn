/**
 * A wall-clock time at a site, as the instant it is. The Scheduler's own
 * answers already carry both; this is for a shift that doesn't exist yet, so
 * the Add shift panel can say who would clash with it.
 */
export function zonedInstant(localDate: string, hhmm: string, timeZone: string): Date {
    const [y, m, d] = localDate.split("-").map(Number) as [number, number, number];
    const [hh, mm] = hhmm.split(":").map(Number) as [number, number];
    const wanted = Date.UTC(y, m - 1, d, hh, mm);

    const format = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
    // How far the zone's wall clock is ahead of UTC at an instant, in ms.
    const offsetAt = (instant: number) => {
        const parts = format.formatToParts(new Date(instant));
        const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
        return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute")) - instant;
    };

    // The offset at the answer can differ from the offset at the guess across a clock change, so look twice.
    const first = wanted - offsetAt(wanted);
    return new Date(wanted - offsetAt(first));
}

/** Today's calendar date at a site, e.g. "2026-10-16". */
export function localToday(timeZone: string, now: Date = new Date()): string {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)!.value;
    return `${get("year")}-${get("month")}-${get("day")}`;
}
