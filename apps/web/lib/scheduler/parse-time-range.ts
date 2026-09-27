/**
 * Turns what a manager types into a shift's wall-clock times.
 *
 *   "9-5"        → 09:00–17:00
 *   "9a-5:30p"   → 09:00–17:30
 *   "17-23"      → 17:00–23:00
 *   "5-1"        → 17:00–01:00 (next day)
 *   "10-2"       → 10:00–14:00
 *   "6a-2p", "11:30am - 7pm", "0930-1500", "4p to 11p"
 *
 * Without am/pm, a start from 1 to 6 means afternoon (a 5 o'clock start is
 * dinner, not dawn) and the end is the next time on the clock after the
 * start. Type the suffix to say otherwise: "6a-2p".
 */

export interface TimeRange {
    startLocal: string;
    endLocal: string;
    /** Ends on the next day. */
    overnight: boolean;
    minutes: number;
}

type Token = { hour: number; minute: number; suffix: "a" | "p" | null; twentyFour: boolean };

const TOKEN = /^(\d{1,2})(?::?(\d{2}))?\s*(a|am|p|pm)?$/;

function parseToken(raw: string): Token | null {
    const text = raw.trim().toLowerCase().replace(/\./g, "");
    if (!text) return null;
    let match = TOKEN.exec(text);
    // "930", "1730": hours and minutes without a colon.
    if (!match && /^\d{3,4}\s*(a|am|p|pm)?$/.test(text)) {
        const digits = text.match(/^\d+/)![0];
        const rest = text.slice(digits.length);
        match = TOKEN.exec(`${digits.slice(0, -2)}:${digits.slice(-2)}${rest}`);
    }
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = match[2] ? Number(match[2]) : 0;
    const suffix = match[3] ? (match[3][0] as "a" | "p") : null;
    if (minute > 59) return null;
    if (suffix ? hour < 1 || hour > 12 : hour > 24) return null;
    return { hour, minute, suffix, twentyFour: !suffix && (hour === 0 || hour > 12) };
}

const toMinutes = (hour24: number, minute: number) => ((hour24 % 24) * 60 + minute) % 1440;

function withSuffix(token: Token): number {
    const h = token.hour % 12;
    return toMinutes(token.suffix === "p" ? h + 12 : h, token.minute);
}

function startMinutes(token: Token): number {
    if (token.suffix) return withSuffix(token);
    if (token.twentyFour) return toMinutes(token.hour, token.minute);
    // 1–6 without a suffix is an afternoon start; 12 is noon; 7–11 morning.
    if (token.hour >= 1 && token.hour <= 6) return toMinutes(token.hour + 12, token.minute);
    return toMinutes(token.hour, token.minute);
}

function endMinutes(token: Token, start: number): number {
    if (token.suffix || token.twentyFour) return withSuffixOr24(token);
    // The next time on the clock after the start.
    const candidates = [toMinutes(token.hour % 12, token.minute), toMinutes((token.hour % 12) + 12, token.minute)];
    return candidates.reduce((best, c) => (duration(start, c) < duration(start, best) ? c : best));
}

const withSuffixOr24 = (token: Token) => (token.suffix ? withSuffix(token) : toMinutes(token.hour, token.minute));

/** Minutes from start to end, wrapping past midnight; a zero length is a full day. */
const duration = (start: number, end: number) => ((end - start + 1440) % 1440) || 1440;

const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export function parseTimeRange(input: string): TimeRange | null {
    const parts = input
        .trim()
        .toLowerCase()
        .split(/\s*(?:-|–|—|to)\s*/);
    if (parts.length !== 2) return null;
    const a = parseToken(parts[0]!);
    const b = parseToken(parts[1]!);
    if (!a || !b) return null;

    // "9-5p": a suffix on the end only also applies to a bare start that would otherwise be ambiguous.
    const start = !a.suffix && !a.twentyFour && b.suffix ? startWithEndHint(a, b) : startMinutes(a);
    const end = endMinutes(b, start);
    const minutes = duration(start, end);
    if (minutes === 1440 || minutes > 16 * 60) return null;
    return { startLocal: hhmm(start), endLocal: hhmm(end), overnight: end <= start, minutes };
}

/** "11-7p" means 11a; "5-11p" means 5p: pick the start that gives the shorter shift. */
function startWithEndHint(start: Token, end: Token): number {
    const endAt = withSuffix(end);
    const candidates = [toMinutes(start.hour % 12, start.minute), toMinutes((start.hour % 12) + 12, start.minute)];
    return candidates.reduce((best, c) => (duration(c, endAt) < duration(best, endAt) ? c : best));
}

/** "09:00"–"17:30" back to the way people type it: "9a-5:30p". */
export function formatTimeRange(startLocal: string, endLocal: string): string {
    const fmt = (t: string) => {
        const [h, m] = t.split(":").map(Number);
        const suffix = h! < 12 ? "a" : "p";
        const h12 = h! % 12 === 0 ? 12 : h! % 12;
        return m ? `${h12}:${String(m).padStart(2, "0")}${suffix}` : `${h12}${suffix}`;
    };
    return `${fmt(startLocal)}-${fmt(endLocal)}`;
}
