import { PhoneNumberUtil, PhoneNumberFormat } from 'google-libphonenumber';

const phoneUtil = PhoneNumberUtil.getInstance();

/**
 * Validates a phone number string.
 * @param phone The phone number to validate (e.g. "+14155552671" or "4155552671")
 * @param region default region code (e.g. "US") if number is not international format
 * @returns boolean indicating if the number is valid
 */
export const validatePhoneNumber = (phone: string, region: string = 'US'): boolean => {
    try {
        const number = phoneUtil.parseAndKeepRawInput(phone, region);
        return phoneUtil.isValidNumber(number);
    } catch (e) {
        return false;
    }
};

/**
 * Formats a phone number to E.164 standard (e.g. "+14155552671").
 * Throws error if invalid.
 * @param phone The phone number to format
 * @param region default region code (e.g. "US")
 * @returns E.164 formatted string
 */
export const formatPhoneNumber = (phone: string, region: string = 'US'): string => {
    try {
        const number = phoneUtil.parseAndKeepRawInput(phone, region);
        if (!phoneUtil.isValidNumber(number)) {
            throw new Error("Invalid phone number");
        }
        return phoneUtil.format(number, PhoneNumberFormat.E164);
    } catch (e) {
        throw new Error(`Failed to format phone number: ${phone}`);
    }
};
