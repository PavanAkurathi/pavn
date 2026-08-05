import { describe, expect, it } from "bun:test";
import { PhoneNumberSchema, SignupSchema, PHONE_NUMBER_ERROR } from "./auth";

describe("PhoneNumberSchema", () => {
    const e164 = "+14158302200";
    const acceptedFormats = [
        "(415) 830-2200",
        "415-830-2200",
        "415.830.2200",
        "4158302200",
        "+1 415 830 2200",
        "1 (415) 830-2200",
        "  4158302200  ",
    ];

    for (const input of acceptedFormats) {
        it(`normalizes ${JSON.stringify(input)} to E.164`, () => {
            expect(PhoneNumberSchema.parse(input)).toBe(e164);
        });
    }

    it("accepts a Canadian number", () => {
        expect(PhoneNumberSchema.parse("(416) 967-1111")).toBe("+14169671111");
    });

    const rejected: Array<[string, string]> = [
        ["fictional exchange", "(555) 010-1234"],
        ["too short", "123"],
        ["not a number", "call me maybe"],
        ["valid number outside US/CA", "+44 20 7946 0958"],
    ];

    for (const [label, input] of rejected) {
        it(`rejects ${label}: ${JSON.stringify(input)}`, () => {
            const result = PhoneNumberSchema.safeParse(input);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0]?.message).toBe(PHONE_NUMBER_ERROR);
            }
        });
    }

    it("rejects an empty string with a required message", () => {
        const result = PhoneNumberSchema.safeParse("");
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]?.message).toBe("Phone number is required");
        }
    });
});

describe("SignupSchema", () => {
    const validSignup = {
        firstName: "Ava",
        lastName: "Tester",
        email: "ava@example.com",
        phone: "(415) 830-2200",
        businessName: "Testaurant Group",
        password: "TestPass123!",
    };

    it("parses a valid signup and normalizes the phone", () => {
        const parsed = SignupSchema.parse(validSignup);
        expect(parsed.phone).toBe("+14158302200");
        expect(parsed.email).toBe("ava@example.com");
    });

    it("rejects an invalid email", () => {
        const result = SignupSchema.safeParse({ ...validSignup, email: "not-an-email" });
        expect(result.success).toBe(false);
    });

    it("rejects a short password", () => {
        const result = SignupSchema.safeParse({ ...validSignup, password: "short" });
        expect(result.success).toBe(false);
    });

    it("rejects the old placeholder-style fictional number", () => {
        const result = SignupSchema.safeParse({ ...validSignup, phone: "(555) 123-4567" });
        expect(result.success).toBe(false);
    });
});
