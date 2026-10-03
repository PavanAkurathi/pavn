import { describe, expect, test } from "bun:test";

import { initials, roleHue } from "../src/lib/role-hue";

describe("roleHue", () => {
    test("common roles use the theme's hue variables", () => {
        expect(roleHue("Bartender")).toBe("var(--hue-bartender)");
        expect(roleHue("Server")).toBe("var(--hue-server)");
        expect(roleHue("Host")).toBe("var(--hue-host)");
        expect(roleHue("Line cook")).toBe("var(--hue-kitchen)");
        expect(roleHue("Security guard")).toBe("var(--hue-security)");
    });

    test("a barback is not a bartender", () => {
        expect(roleHue("Barback")).toBe("var(--hue-barback)");
        expect(roleHue("Bar")).toBe("var(--hue-bartender)");
    });

    test("no role falls back to the default hue", () => {
        expect(roleHue(null)).toBe("var(--hue-default)");
        expect(roleHue("")).toBe("var(--hue-default)");
    });

    test("other roles keep one colour, whatever the case", () => {
        expect(roleHue("Cashier")).toBe(roleHue("cashier"));
        expect(roleHue("Cashier")).toMatch(/^#[0-9a-f]{6}$/);
    });
});

describe("initials", () => {
    test("first and last initial", () => {
        expect(initials("Maya R.")).toBe("MR");
        expect(initials("  Jean  Luc  Picard ")).toBe("JL");
    });

    test("one word gives its first two letters, nothing gives ?", () => {
        expect(initials("Cher")).toBe("CH");
        expect(initials("")).toBe("?");
        expect(initials(null)).toBe("?");
    });
});
