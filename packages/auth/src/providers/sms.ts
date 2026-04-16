import { validatePhoneNumber, formatPhoneNumber } from "@repo/utils";
import { DEEPLINK_CONFIG } from "@repo/config";

// Supported regions: US and Canada (same E.164 +1 prefix, both validated by libphonenumber)
const SUPPORTED_REGIONS = ["US", "CA"] as const;
type SupportedRegion = typeof SUPPORTED_REGIONS[number];

/**
 * Validates a phone number against US or CA formats.
 * Tries US first (default), then CA if US fails — both share the +1 country code.
 */
export const isValidPhoneNumber = (phone: string): boolean => {
    for (const region of SUPPORTED_REGIONS) {
        if (validatePhoneNumber(phone, region)) return true;
    }
    return false;
};

/**
 * Normalizes a phone number to E.164 format.
 * Tries US first (covers most +1 numbers), falls back to CA.
 */
export const normalizePhoneNumber = (phone: string): string => {
    for (const region of SUPPORTED_REGIONS) {
        if (validatePhoneNumber(phone, region)) {
            return formatPhoneNumber(phone, region);
        }
    }
    // Default to US formatting (will throw if truly invalid)
    return formatPhoneNumber(phone, "US");
};

// ── Twilio (lazy ESM-safe initialization) ────────────────────────────────────

let twilioClient: Awaited<ReturnType<typeof buildTwilioClient>> | null = null;
const allowMockOtpDebug =
    process.env.NODE_ENV !== "production" && process.env.ALLOW_MOCK_OTP_DEBUG === "true";

async function buildTwilioClient() {
    if (process.env.MOCK_SMS === "true") return null;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("[SMS FATAL] Missing Twilio credentials in production");
        }
        console.warn("[SMS] Missing Twilio credentials — running in mock mode");
        return null;
    }

    // ESM-compatible dynamic import (no require())
    const { default: twilio } = await import("twilio");
    return {
        client: twilio(accountSid, authToken),
        from: normalizePhoneNumber(fromNumber),
    };
}

async function getTwilioClient() {
    if (!twilioClient) {
        twilioClient = await buildTwilioClient();
    }
    return twilioClient;
}

// ── Send SMS ──────────────────────────────────────────────────────────────────

export async function sendSMS(to: string, body: string): Promise<void> {
    const twilio = await getTwilioClient();
    const normalizedTo = normalizePhoneNumber(to);

    if (!twilio) {
        const code = body.match(/\b(\d{6})\b/)?.[1];
        const target = `***${normalizedTo.slice(-4)}`;
        console.warn(`[SMS MOCK] Delivery skipped for ${target}`);

        if (allowMockOtpDebug && code) {
            console.warn(`[SMS MOCK] Debug OTP enabled for ${target}`);
        }
        return;
    }

    await twilio.client.messages.create({
        body,
        from: twilio.from,
        to: normalizedTo,
    });
    // Don't log phone numbers in production — log only last 4 digits
    console.log(`[SMS] Sent to ***${normalizedTo.slice(-4)}`);
}

// ── Worker Invitation SMS ─────────────────────────────────────────────────────
// This is the deep link message sent when a business invites a gig worker.

export async function sendWorkerInviteSMS(
    to: string,
    companyName: string,
    orgId: string,
    inviteToken: string
): Promise<void> {
    const deepLink = DEEPLINK_CONFIG.buildInviteLink(orgId, inviteToken);

    const message =
        `${companyName} invited you to Workers Hive. ` +
        `View your schedule & shifts: ${deepLink}`;

    await sendSMS(to, message);
}

export async function sendOTP(phoneNumber: string, code: string): Promise<void> {
    const message = `Your Workers Hive verification code is: ${code}. Valid for 5 minutes.`;
    await sendSMS(phoneNumber, message);
}
