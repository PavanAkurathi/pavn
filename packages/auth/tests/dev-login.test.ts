import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";

import { readDevLoginConfig, safeNextPath, tokenMatches } from "../src/dev-login";

const TOKEN = "a".repeat(40);
const TOKEN_SHA256 = createHash("sha256").update(TOKEN).digest("hex");
const COMMITTED = { tokenSha256: TOKEN_SHA256, account: { userId: "user_1" } };

describe("readDevLoginConfig", () => {
    test("is off with no env vars and nothing committed", () => {
        expect(readDevLoginConfig({}, null)).toBeNull();
        expect(readDevLoginConfig({ DEV_LOGIN_TOKEN: TOKEN }, null)).toBeNull();
        expect(readDevLoginConfig({ DEV_LOGIN_EMAIL: "owner@example.com" }, null)).toBeNull();
    });

    test("uses the env vars first, trimmed, with the email lowercased", () => {
        const config = readDevLoginConfig({ DEV_LOGIN_TOKEN: ` ${TOKEN} `, DEV_LOGIN_EMAIL: " Owner@Example.com " }, COMMITTED);
        expect(config?.account).toEqual({ email: "owner@example.com" });
        expect(config?.tokenSha256.toString("hex")).toBe(TOKEN_SHA256);
    });

    test("refuses a short env token", () => {
        expect(readDevLoginConfig({ DEV_LOGIN_TOKEN: "short", DEV_LOGIN_EMAIL: "owner@example.com" }, null)).toBeNull();
    });

    test("falls back to the committed fingerprint", () => {
        const config = readDevLoginConfig({}, COMMITTED);
        expect(config?.account).toEqual({ userId: "user_1" });
        expect(config?.tokenSha256.toString("hex")).toBe(TOKEN_SHA256);
    });

    test("ignores a committed value that isn't a SHA-256 fingerprint", () => {
        expect(readDevLoginConfig({}, { ...COMMITTED, tokenSha256: "not-a-hash" })).toBeNull();
    });

    test("DEV_LOGIN=off switches it off everywhere", () => {
        expect(readDevLoginConfig({ DEV_LOGIN: "off" }, COMMITTED)).toBeNull();
        expect(readDevLoginConfig({ DEV_LOGIN: "OFF", DEV_LOGIN_TOKEN: TOKEN, DEV_LOGIN_EMAIL: "o@example.com" }, COMMITTED)).toBeNull();
    });
});

describe("tokenMatches", () => {
    const expected = Buffer.from(TOKEN_SHA256, "hex");

    test("accepts only the exact secret", () => {
        expect(tokenMatches(expected, TOKEN)).toBe(true);
        expect(tokenMatches(expected, `${TOKEN}x`)).toBe(false);
        expect(tokenMatches(expected, TOKEN.slice(1))).toBe(false);
        expect(tokenMatches(expected, TOKEN_SHA256)).toBe(false);
        expect(tokenMatches(expected, "")).toBe(false);
        expect(tokenMatches(expected, undefined)).toBe(false);
        expect(tokenMatches(expected, [TOKEN])).toBe(false);
    });
});

describe("safeNextPath", () => {
    test("keeps same-site paths", () => {
        expect(safeNextPath("/dashboard/shifts")).toBe("/dashboard/shifts");
        expect(safeNextPath("/schedule?week=2026-09-28")).toBe("/schedule?week=2026-09-28");
    });

    test("falls back to the Scheduler for anything that could leave the site", () => {
        expect(safeNextPath(undefined)).toBe("/schedule");
        expect(safeNextPath("https://evil.example")).toBe("/schedule");
        expect(safeNextPath("//evil.example")).toBe("/schedule");
        expect(safeNextPath("/\\evil.example")).toBe("/schedule");
        expect(safeNextPath("schedule")).toBe("/schedule");
    });
});
