import { PhoneNumberUtil, PhoneNumberFormat } from 'google-libphonenumber';

const phoneUtil = PhoneNumberUtil.getInstance();

/**
 * Resolves the region a phone number actually belongs to, restricted to the
 * given candidate regions. Unlike validatePhoneNumber, a number written in
 * international format (e.g. "+44...") for a region outside the candidates
 * returns null instead of passing.
 * @param phone The phone number in any common format
 * @param candidates Allowed region codes, tried in order as parsing hints
 * @returns the matched region code, or null if invalid or unsupported
 */
export const getPhoneRegion = (
    phone: string,
    candidates: readonly string[] = ['US', 'CA'],
): string | null => {
    for (const region of candidates) {
        try {
            const number = phoneUtil.parseAndKeepRawInput(phone, region);
            if (phoneUtil.isValidNumber(number)) {
                const actual = phoneUtil.getRegionCodeForNumber(number);
                return actual && candidates.includes(actual) ? actual : null;
            }
        } catch {
            // try next candidate region
        }
    }
    return null;
};

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
    } catch {
        // libphonenumber throws on unparseable input; that just means invalid.
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
    } catch (cause) {
        // Preserve the parser's reason — without it, a bad region code and a
        // malformed number are indistinguishable at the call site.
        throw new Error(`Failed to format phone number: ${phone}`, { cause });
    }
};
