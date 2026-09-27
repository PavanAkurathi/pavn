/**
 * Request times are read in the timezone they belong to (the shift's site or
 * the workplace), not the phone's, matching "All times are site local".
 */

const time = (iso: string | Date, timeZone: string) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone });

const day = (iso: string | Date, timeZone: string) =>
    new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone });

/** "2026-09-29": for grouping by the site's calendar day. */
export const dayKey = (iso: string, timeZone: string) =>
    new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).format(new Date(iso));

export const dayTitle = (iso: string, timeZone: string) =>
    new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone });

/** "4:00 PM – 11:00 PM" */
export const timeRange = (startIso: string, endIso: string, timeZone: string) => `${time(startIso, timeZone)} – ${time(endIso, timeZone)}`;

/** "Tue, Sep 29 · 4:00 PM – 11:00 PM" */
export const shiftWhen = (s: { startTime: string; endTime: string; timezone: string }) =>
    `${day(s.startTime, s.timezone)} · ${timeRange(s.startTime, s.endTime, s.timezone)}`;

/** "Tue, Sep 29", "Tue, Sep 29 – Thu, Oct 1", or a day with times. */
export function timeOffWhen(w: { startTime: string; endTime: string; allDay: boolean; timezone: string }) {
    // The end is exclusive: a day off ends at the next midnight.
    const last = new Date(new Date(w.endTime).getTime() - 1);
    const first = day(w.startTime, w.timezone);
    const lastDay = day(last, w.timezone);
    if (w.allDay) return first === lastDay ? first : `${first} – ${lastDay}`;
    if (first === lastDay) return `${first} · ${timeRange(w.startTime, w.endTime, w.timezone)}`;
    return `${first} ${time(w.startTime, w.timezone)} – ${day(w.endTime, w.timezone)} ${time(w.endTime, w.timezone)}`;
}
