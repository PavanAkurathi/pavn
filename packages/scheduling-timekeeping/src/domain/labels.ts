// packages/scheduling-timekeeping/src/domain/labels.ts

/**
 * Short, human times for messages managers read in the grid: "9a", "5:30p",
 * "12a". They match how the scheduler draws shifts, so a warning that says
 * "Already on Mon 11a–7p" points at a chip that says exactly that.
 */

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function compactTime(localTime: string): string {
    const [h = 0, m = 0] = localTime.split(":").map(Number);
    const hour = h % 24;
    const suffix = hour < 12 ? "a" : "p";
    const twelve = hour % 12 || 12;
    return m ? `${twelve}:${String(m).padStart(2, "0")}${suffix}` : `${twelve}${suffix}`;
}

export function compactRange(startLocal: string, endLocal: string): string {
    return `${compactTime(startLocal)}–${compactTime(endLocal)}`;
}

/** Weekday name for a local date ("YYYY-MM-DD"). */
export function dayName(localDate: string): string {
    const [y, m, d] = localDate.split("-").map(Number);
    return DAY_NAMES[new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay()]!;
}

/** "1.5h" / "8h": whole hours drop the decimal. */
export function compactHours(minutes: number): string {
    const hours = Math.round((minutes / 60) * 10) / 10;
    return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}
