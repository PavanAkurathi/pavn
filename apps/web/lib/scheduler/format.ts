/**
 * Display helpers for the Scheduler. The API already sends the location's wall
 * clock ("HH:mm" on a local date), so nothing here touches timezones: dates
 * are plain calendar strings and all arithmetic happens in UTC.
 */

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(localDate: string) {
    const [y, m, d] = localDate.split("-").map(Number);
    return { y: y!, m: m!, d: d! };
}

function toUtc(localDate: string) {
    const { y, m, d } = parts(localDate);
    return new Date(Date.UTC(y, m - 1, d));
}

/** "09:00" → "9a", "17:30" → "5:30p", "00:00" and "24:00" → "12a". */
export function compactTime(hhmm: string): string {
    const [hRaw, mRaw] = hhmm.split(":");
    const h = Number(hRaw) % 24;
    const m = Number(mRaw);
    const suffix = h < 12 ? "a" : "p";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

export function compactRange(start: string, end: string): string {
    return `${compactTime(start)}–${compactTime(end)}`;
}

/** 390 → "6.5h", 2400 → "40h", 20 → "0.3h". */
export function formatHours(minutes: number): string {
    const hours = Math.round((minutes / 60) * 10) / 10;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}

export function addDays(localDate: string, days: number): string {
    const date = toUtc(localDate);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

export function weekdayShort(localDate: string): string {
    return WEEKDAYS_SHORT[toUtc(localDate).getUTCDay()]!;
}

export function dayOfMonth(localDate: string): number {
    return parts(localDate).d;
}

/** "Sep 27 – Oct 3", or "Sep 6 – 12" inside one month; the year only when it differs. */
export function weekRangeLabel(firstDay: string, lastDay: string, today?: string): string {
    const a = parts(firstDay);
    const b = parts(lastDay);
    const currentYear = today ? parts(today).y : a.y;
    const year = a.y !== currentYear || b.y !== currentYear ? `, ${b.y}` : "";
    const start = `${MONTHS_SHORT[a.m - 1]} ${a.d}`;
    const end = a.m === b.m && a.y === b.y ? `${b.d}` : `${MONTHS_SHORT[b.m - 1]} ${b.d}`;
    return `${start} – ${end}${year}`;
}

/** "Friday, October 16": the calendar day in words, whatever the browser's time zone. */
export function longDate(localDate: string): string {
    return toUtc(localDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

/** "Fri, Oct 16". */
export function shortDate(localDate: string): string {
    const { m, d } = parts(localDate);
    return `${weekdayShort(localDate)}, ${MONTHS_SHORT[m - 1]} ${d}`;
}

function twelveHour(hhmm: string) {
    const h = Number(hhmm.slice(0, 2)) % 24;
    const m = Number(hhmm.slice(3, 5));
    return { clock: `${h % 12 === 0 ? 12 : h % 12}${m === 0 ? "" : `:${String(m).padStart(2, "0")}`}`, meridiem: h < 12 ? "am" : "pm" };
}

/**
 * A shift's hours the way people say them: "11am–4pm", and "5–11pm" when both
 * ends are in the same half of the day.
 */
export function clockRange(start: string, end: string, options: { spaced?: boolean } = {}): string {
    const a = twelveHour(start);
    const b = twelveHour(end);
    const dash = options.spaced ? " – " : "–";
    return a.meridiem === b.meridiem ? `${a.clock}${dash}${b.clock}${b.meridiem}` : `${a.clock}${a.meridiem}${dash}${b.clock}${b.meridiem}`;
}

/** "Oct 11 – 17, 2026", always with the year. */
export function weekRangeFull(firstDay: string, lastDay: string): string {
    const a = parts(firstDay);
    const b = parts(lastDay);
    const start = `${MONTHS_SHORT[a.m - 1]} ${a.d}`;
    if (a.y !== b.y) return `${start}, ${a.y} – ${MONTHS_SHORT[b.m - 1]} ${b.d}, ${b.y}`;
    const end = a.m === b.m ? `${b.d}` : `${MONTHS_SHORT[b.m - 1]} ${b.d}`;
    return `${start} – ${end}, ${b.y}`;
}

/** 1200 → "20 hrs", 1230 → "20.5 hrs", 60 → "1 hr". */
export function hoursLabel(minutes: number): string {
    const hours = Math.round((minutes / 60) * 10) / 10;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} ${hours === 1 ? "hr" : "hrs"}`;
}
