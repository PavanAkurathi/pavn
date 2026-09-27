import type { RequestShift } from "@repo/contracts/requests";
import { compactRange, compactTime, weekdayShort } from "./format";

/**
 * Requests carry real instants plus the timezone they belong to (a worker's
 * time off or a shift at another location), so these read the wall clock
 * there rather than in the manager's browser.
 */

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function wallClock(iso: string | Date, timeZone: string): { date: string; time: string } {
    const format = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    });
    const p = Object.fromEntries(format.formatToParts(typeof iso === "string" ? new Date(iso) : iso).map((x) => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** "Tue Sep 29" for a local "YYYY-MM-DD". */
export function dayLabel(localDate: string) {
    const [, m, d] = localDate.split("-").map(Number);
    return `${weekdayShort(localDate)} ${MONTHS_SHORT[m! - 1]} ${d}`;
}

/** "Tue Sep 29 · 4p–11p" */
export function shiftWhen(shift: Pick<RequestShift, "startTime" | "endTime" | "timezone">) {
    const start = wallClock(shift.startTime, shift.timezone);
    const end = wallClock(shift.endTime, shift.timezone);
    return `${dayLabel(start.date)} · ${compactRange(start.time, end.time)}`;
}

/** "Tue Sep 29 · all day", "Tue Sep 29 – Thu Oct 1", "Tue Sep 29 · 2p–6p". */
export function timeOffWhen(window: { startTime: string; endTime: string; allDay: boolean; timezone: string }) {
    const start = wallClock(window.startTime, window.timezone);
    // The end is exclusive: a day off ends at the next midnight.
    const lastMoment = wallClock(new Date(new Date(window.endTime).getTime() - 1), window.timezone);
    const end = wallClock(window.endTime, window.timezone);
    if (window.allDay) {
        return start.date === lastMoment.date ? `${dayLabel(start.date)} · all day` : `${dayLabel(start.date)} – ${dayLabel(lastMoment.date)}`;
    }
    if (start.date === lastMoment.date) return `${dayLabel(start.date)} · ${compactRange(start.time, end.time)}`;
    return `${dayLabel(start.date)} ${compactTime(start.time)} – ${dayLabel(end.date)} ${compactTime(end.time)}`;
}

/** "just now", "5m ago", "3h ago", "2d ago". */
export function timeAgo(iso: string, now = new Date()) {
    const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
}
