import { validatePhoneNumber, formatPhoneNumber } from "@repo/utils";

export const isValidPhoneNumber = (phone: string): boolean => {
    return validatePhoneNumber(phone, 'US');
};

export const normalizePhoneNumber = (phone: string): string => {
    return formatPhoneNumber(phone, 'US');
};


let twilioClient: any = null;

const getTwilioClient = () => {
    if (twilioClient) return twilioClient;

    if (process.env.MOCK_SMS === "true") return null;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    console.log("[SMS DEBUG] Loading Credentials...");
    console.log(`[SMS DEBUG] SID Present: ${!!accountSid}`);
    console.log(`[SMS DEBUG] Token Present: ${!!authToken}`);
    console.log(`[SMS DEBUG] Phone Present: ${!!process.env.TWILIO_PHONE_NUMBER}`);

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
            console.log("\n🛑 ----------------------------------------");
            console.log(" [SMS MOCK] To:", to);
            console.log(" [SMS MOCK] Body:", body);
            console.log("---------------------------------------- 🛑\n");

            // Helper for dev: write to file
            if (process.env.NODE_ENV !== "production") {
                const fs = require('fs');
                try {
                    const otpMatch = body.match(/code is: (\d+)/);
                    if (otpMatch && otpMatch[1]) {
                        // Write to TMP for absolute certainty
                        fs.writeFileSync('/tmp/pavn-otp.txt', otpMatch[1]);
                        // Also try project root
                        fs.writeFileSync('latest-otp.txt', otpMatch[1]);
                    }
                } catch (e) {
                    console.error("Failed to write OTP file:", e);
                }
            }
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

        const validFrom = normalizePhoneNumber(from as string);
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
