import { z } from "zod";
import { getPhoneRegion, formatPhoneNumber } from "./phone";

/**
 * Regions accepted for phone-based auth and SMS delivery. Both share the +1
 * country code and are validated against real numbering plans (libphonenumber),
 * so format-only tricks like "(555) 123-4567" are rejected.
 */
export const SUPPORTED_PHONE_REGIONS = ["US", "CA"] as const;

export const PHONE_NUMBER_ERROR = "Enter a valid US or Canada phone number";

/**
 * Validates a US/CA phone number in any common format and normalizes it to
 * E.164 (e.g. "(415) 830-2200" → "+14158302200"). Shared by the web signup
 * form and the auth server so both sides agree on what "valid" means.
 */
export const PhoneNumberSchema = z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .refine((value) => getPhoneRegion(value, SUPPORTED_PHONE_REGIONS) !== null, {
        error: PHONE_NUMBER_ERROR,
    })
    .transform((value) => {
        const region = getPhoneRegion(value, SUPPORTED_PHONE_REGIONS);
        // Refine above guarantees a region; guard keeps the transform total.
        return region ? formatPhoneNumber(value, region) : value;
    });

export type PhoneNumberInput = z.input<typeof PhoneNumberSchema>;

export const SignupSchema = z.object({
    firstName: z.string().trim().min(2, "First name must be at least 2 characters"),
    lastName: z.string().trim().min(2, "Last name must be at least 2 characters"),
    email: z.email("Please enter a valid email address"),
    phone: PhoneNumberSchema,
    businessName: z.string().trim().min(2, "Business name must be at least 2 characters"),
    password: z.string().min(8, "Password must be at least 8 characters"),
});

/** Raw form values before validation (what the user typed). */
export type SignupInput = z.input<typeof SignupSchema>;
/** Parsed values after validation (phone normalized to E.164). */
export type SignupValues = z.output<typeof SignupSchema>;
