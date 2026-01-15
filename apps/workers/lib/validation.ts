import { z } from 'zod';

// E.164 Regex: + followed by 1-15 digits
const e164Regex = /^\+[1-9]\d{1,14}$/;

export const phoneSchema = z.string()
    .transform(val => val.replace(/[^\d+]/g, '')) // Strip ( ) - space
    .transform(val => {
        if (val.length === 10) return `+1${val}`; // Assume US/Canada if 10 digits
        if (val.length === 11 && val.startsWith('1')) return `+${val}`; // Handle 1-prefix without +
        return val;
    })
    .refine((val) => e164Regex.test(val), {
        message: "Invalid phone number. Try entering 10 digits (e.g. 5551234567)."
    });

export const otpSchema = z.string()
    .length(6, "OTP must be exactly 6 digits")
    .regex(/^\d+$/, "OTP must contain only numbers");

// Helper to validate and return error message string or null
export const validate = <T>(schema: z.ZodSchema<T>, data: unknown): string | null => {
    const result = schema.safeParse(data);
    if (!result.success) {
        return result.error.errors[0].message;
    }
    return null;
};
