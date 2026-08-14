import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { format } from "date-fns";

/**
 * Wall-clock time in a place, converted to the instant it actually happened.
 *
 * Everything that turns a schedule into timestamps must go through here, so
 * "09:00 at this location" has exactly one meaning across the codebase.
 *
 * @param dateStr local calendar date, "YYYY-MM-DD"
 * @param timeStr local wall time, "HH:mm"
 * @param timeZone IANA zone of the location
 */
export function combineDateTimeTz(dateStr: string, timeStr: string, timeZone: string): Date {
    return fromZonedTime(`${dateStr}T${timeStr}:00`, timeZone);
}

/** The local calendar date ("YYYY-MM-DD") an instant falls on, in a given zone. */
export function localDateInZone(instant: Date, timeZone: string): string {
    return format(toZonedTime(instant, timeZone), "yyyy-MM-dd");
}

/** The local wall time ("HH:mm") an instant falls on, in a given zone. */
export function localTimeInZone(instant: Date, timeZone: string): string {
    return format(toZonedTime(instant, timeZone), "HH:mm");
}

/**
 * Shift a local calendar date by whole days.
 *
 * Deliberately operates on the date string rather than on an instant: adding
 * 7 * 24h to a timestamp lands an hour off across a DST boundary, which would
 * turn a copied 9:00 AM shift into 8:00 AM. Moving the calendar date and
 * re-deriving the instant keeps the wall clock intact.
 */
export function addDaysToLocalDate(dateStr: string, days: number): string {
    const [year, month, day] = dateStr.split("-").map(Number);
    const shifted = new Date(Date.UTC(year!, (month ?? 1) - 1, (day ?? 1) + days));
    return shifted.toISOString().slice(0, 10);
}
