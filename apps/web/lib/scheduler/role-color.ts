/**
 * One colour per role, stable across weeks. Common restaurant roles keep the
 * theme's role colours used elsewhere in the app; anything else gets a pale
 * colour picked by hashing its name, so "Cashier" is the same every week
 * without anyone configuring it. All of them carry dark text.
 */

const FAMILIES: [RegExp, string][] = [
    [/server|waiter|waitress/i, "var(--role-server)"],
    [/bartender|barback|\bbar\b/i, "var(--role-bartender)"],
    [/kitchen|chef|cook|prep|dish/i, "var(--role-kitchen)"],
    [/host/i, "var(--role-host)"],
    [/busser|runner|support/i, "var(--role-support)"],
];

const PALETTE = ["#93c5fd", "#a5b4fc", "#86efac", "#fcd34d", "#f9a8d4", "#67e8f9", "#bef264", "#c4b5fd", "#fdba74", "#99f6e4"];

function hash(value: string): number {
    let h = 0;
    for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
    return Math.abs(h);
}

export function roleColor(role: string | null | undefined): string {
    if (!role) return "var(--role-default)";
    for (const [pattern, color] of FAMILIES) if (pattern.test(role)) return color;
    return PALETTE[hash(role.toLowerCase()) % PALETTE.length]!;
}
