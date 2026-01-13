export const isValidPhoneNumber = (phone: string): boolean => {
    // Basic regex for supported countries
    // USA/Canada: +1 followed by 10 digits
    // Australia: +61 followed by 9 digits
    const usaCanadaRegex = /^\+1\d{10}$/;
    const australiaRegex = /^\+61\d{9}$/;
    return usaCanadaRegex.test(phone) || australiaRegex.test(phone);
};

export const normalizePhoneNumber = (phone: string): string => {
    // Remove spaces, dashes, and parentheses
    let cleaned = phone.replace(/[\s\-\(\)]/g, "");

    // If it starts with '1' and is 11 digits, add '+'
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
        return `+${cleaned}`;
    }

    // If it starts with '61' and is 11 digits (e.g. 614...), add '+'
    if (cleaned.length === 11 && cleaned.startsWith("61")) {
        return `+${cleaned}`;
    }

    // If it is 10 digits (USA local), add '+1'
    if (cleaned.length === 10) {
        return `+1${cleaned}`;
    }

    // If it's already in E.164 format (starts with +), just return cleaned
    // Note: This assumes the user typed the +
    return cleaned;
};


let twilioClient: any = null;

const getTwilioClient = () => {
    if (twilioClient) return twilioClient;

    if (process.env.MOCK_SMS === "true") return null;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("Missing Twilio credentials in production");
        }
        return null;
    }

    const twilio = require("twilio");
    twilioClient = twilio(accountSid, authToken);
    return twilioClient;
};


export const sendSMS = async (to: string, body: string): Promise<void> => {
    try {
        const client = getTwilioClient();

        if (!client) {
            console.log("----------------------------------------");
            console.log(" [SMS MOCK] To:", to);
            console.log(" [SMS MOCK] Body:", body);
            console.log("----------------------------------------");
            return;
        }

        const from = process.env.TWILIO_PHONE_NUMBER;
        if (!from) {
            if (process.env.NODE_ENV === "production") {
                throw new Error("Missing TWILIO_PHONE_NUMBER in production");
            }
            console.warn("[SMS WARNING] TWILIO_PHONE_NUMBER not set. Message not sent.");
            return;
        }

        const validFrom = normalizePhoneNumber(from);
        const validTo = normalizePhoneNumber(to);

        await client.messages.create({
            body,
            from: validFrom,
            to: validTo,
        });

    } catch (error) {
        const maskedPhone = to.slice(-4).padStart(to.length, "*");
        console.error(`[SMS ERROR] Failed to send to ${maskedPhone}:`, error);

        // In production, we might want to re-throw or handle differently
        // but for now, we catch to prevent crashing the auth flow
        // Always re-throw so the caller knows it failed
        throw error;
    }
};

export const sendOTP = async (phoneNumber: string, code: string): Promise<void> => {
    const message = `Your Pavn verification code is: ${code}`;
    await sendSMS(phoneNumber, message);
};
