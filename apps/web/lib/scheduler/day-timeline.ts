/**
 * The Day view's arithmetic: where a shift sits on a row of hours, which hours
 * the row shows, and how overlapping shifts stack. Pure, so it is tested
 * without a browser.
 */

/** The hours a day shows when nothing on it reaches further: 8am to 10pm. */
export const DAY_FROM = 8;
export const DAY_TO = 22;

/** "17:30" → 1050. "24:00" → 1440. */
export function minutesOf(hhmm: string): number {
    const [h, m] = hhmm.split(":").map(Number) as [number, number];
    return h * 60 + m;
}

/** Minutes from the start of the day; an end at or before the start is the next day. */
export function spanOf(startLocal: string, endLocal: string): { start: number; end: number } {
    const start = minutesOf(startLocal);
    let end = minutesOf(endLocal);
    if (end <= start) end += 24 * 60;
    return { start, end };
}

/** Whole hours from the earliest start to the latest end, never narrower than 8am to 10pm. */
export function hourRange(spans: { start: number; end: number }[]): { from: number; to: number } {
    const from = Math.min(DAY_FROM, ...spans.map((s) => Math.floor(s.start / 60)));
    const to = Math.min(48, Math.max(DAY_TO, ...spans.map((s) => Math.ceil(s.end / 60))));
    return { from, to };
}

/** Left edge and width of a span, as percentages of the row. Clipped to the row. */
export function placeSpan(span: { start: number; end: number }, range: { from: number; to: number }): { left: number; width: number } {
    const total = (range.to - range.from) * 60;
    const start = Math.max(span.start, range.from * 60);
    const end = Math.min(span.end, range.to * 60);
    return { left: ((start - range.from * 60) / total) * 100, width: (Math.max(0, end - start) / total) * 100 };
}

/** Puts each span in the first lane where it overlaps nothing. Lanes are numbered from 0, in input order. */
export function packLanes(spans: { start: number; end: number }[]): { lanes: number[]; count: number } {
    const order = spans.map((_, i) => i).sort((a, b) => spans[a]!.start - spans[b]!.start || spans[a]!.end - spans[b]!.end);
    const laneEnds: number[] = [];
    const lanes = new Array<number>(spans.length).fill(0);
    for (const i of order) {
        const span = spans[i]!;
        let lane = laneEnds.findIndex((end) => end <= span.start);
        if (lane === -1) lane = laneEnds.length;
        laneEnds[lane] = span.end;
        lanes[i] = lane;
    }
    return { lanes, count: Math.max(1, laneEnds.length) };
}

/** "13" → "13:00"; past midnight wraps: "26" → "02:00". */
export function hourToLocal(hour: number): string {
    return `${String(((hour % 24) + 24) % 24).padStart(2, "0")}:00`;
}

/** The site's wall-clock minutes since midnight, for the line that marks now. */
export function minutesNow(timeZone: string, now: Date = new Date()): number {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(now);
    const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
    return get("hour") * 60 + get("minute");
}
