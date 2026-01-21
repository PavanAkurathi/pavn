import { describe, expect, test } from "bun:test";
import { validatePhoneNumber, formatPhoneNumber } from "../src/phone";

describe("Phone Utils", () => {
    test("validates US numbers correctly", () => {
        expect(validatePhoneNumber("4155552671", "US")).toBe(true);
        expect(validatePhoneNumber("+14155552671", "US")).toBe(true);
        expect(validatePhoneNumber("123", "US")).toBe(false);
    });

    test("formats US numbers to E.164", () => {
        expect(formatPhoneNumber("4155552671", "US")).toBe("+14155552671");
        expect(formatPhoneNumber("(415) 555-2671", "US")).toBe("+14155552671");
    });

    test("handles invalid numbers gracefully", () => {
        expect(() => formatPhoneNumber("invalid")).toThrow();
        expect(validatePhoneNumber("invalid")).toBe(false);
    });
});
