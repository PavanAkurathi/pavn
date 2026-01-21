import { z } from 'zod';
import { validatePhoneNumber, formatPhoneNumber } from '@repo/utils';

export const phoneSchema = z.string()
    .refine((val) => validatePhoneNumber(val, 'US'), {
        message: "Invalid phone number. Please enter a valid 10-digit number."
    })
    .transform((val) => formatPhoneNumber(val, 'US'));

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
