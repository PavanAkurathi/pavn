import { validatePhoneNumber, formatPhoneNumber } from "@repo/utils";
import { DEEPLINK_CONFIG } from "@repo/config";

export const isValidPhoneNumber = (phone: string): boolean =>
    validatePhoneNumber(phone, "US"); // TODO: make locale configurable when you expand internationally

export const normalizePhoneNumber = (phone: string): string =>
    formatPhoneNumber(phone, "US");

// ── Twilio (lazy ESM-safe initialization) ────────────────────────────────────

let twilioClient: Awaited<ReturnType<typeof buildTwilioClient>> | null = null;

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

    if (!twilio) {
        // Dev mock — write OTP to file for easy access during development
        const code = body.match(/\b(\d{6})\b/)?.[1];
        console.log(`\n📱 [SMS MOCK] → ${to}\n   ${body}\n`);

        if (process.env.NODE_ENV !== "production" && code) {
            const { writeFileSync } = await import("fs");
            try {
                writeFileSync("/tmp/latest-otp.txt", code);
            } catch {
                // Non-critical
            }
        }
        return;
    }

    const normalizedTo = normalizePhoneNumber(to);

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
