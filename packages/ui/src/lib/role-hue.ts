/**
 * One saturated hue per role, stable across weeks. The common roles use the
 * theme's --hue-* variables (so light and dark each get a fitting shade);
 * anything else gets a hue picked by hashing its name, so "Cashier" is the same
 * every week without anyone configuring it.
 *
 * A hue is one colour: ShiftCard, Pill and the role dots derive their tint,
 * border and bar from it with color-mix.
 */

const FAMILIES: [RegExp, string][] = [
    [/barback/i, "var(--hue-barback)"],
    [/bartender|\bbar\b/i, "var(--hue-bartender)"],
    [/server|waiter|waitress/i, "var(--hue-server)"],
    [/security|guard|bouncer/i, "var(--hue-security)"],
    [/kitchen|chef|cook|prep|dish/i, "var(--hue-kitchen)"],
    [/host/i, "var(--hue-host)"],
    [/busser|runner|support/i, "var(--hue-support)"],
];

// Kept clear of the family hues above, so a hashed role never reads as one of them.
const PALETTE = ["#06b6d4", "#ec4899", "#84cc16", "#f97316", "#14b8a6", "#6366f1", "#a855f7", "#0ea5e9", "#d946ef", "#22c55e"];

function hash(value: string): number {
    let h = 0;
    for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
    return Math.abs(h);
}

export function roleHue(role: string | null | undefined): string {
    if (!role) return "var(--hue-default)";
    for (const [pattern, hue] of FAMILIES) if (pattern.test(role)) return hue;
    return PALETTE[hash(role.toLowerCase()) % PALETTE.length]!;
}

/** "Maya R." -> "MR"; one word -> its first two letters; nothing -> "?". */
export function initials(name: string | null | undefined): string {
    const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "?";
    if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
    return (words[0]![0]! + words[1]![0]!).toUpperCase();
}
