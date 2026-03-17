import { Resend } from 'resend';

// Initialize Resend with API Key from environment
const FROM_EMAIL = process.env.EMAIL_FROM || "onboarding@resend.dev"; // Use EMAIL_FROM env var or fallback to default
const allowEmailOtpDebug =
    process.env.NODE_ENV !== "production" && process.env.ALLOW_EMAIL_OTP_DEBUG === "true";
const maskEmail = (email: string) => {
    const [local, domain] = email.split("@");
    if (!local || !domain) return "***";
    return `${local.slice(0, 2)}***@${domain}`;
};

export const sendOtp = async (email: string, otp: string) => {
    const apiKey = process.env.RESEND_API_KEY;
    const isProd = process.env.NODE_ENV === "production";

    if (!apiKey) {
        console.warn(`[Email] RESEND_API_KEY is missing. OTP delivery skipped for ${maskEmail(email)}.`);
        if (allowEmailOtpDebug) {
            console.warn(`[Email] OTP debug enabled for ${maskEmail(email)}.`);
        }
        return;
    }

    const resend = new Resend(apiKey);

    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: 'Your Verification Code',
            html: `
                <div style="font-family: sans-serif; line-height: 1.5;">
                    <h1>Verify your email</h1>
                    <p>Your verification code is:</p>
                    <div style="padding: 12px 24px; background-color: #f4f4f5; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 4px; display: inline-block; margin: 16px 0;">
                        ${otp}
                    </div>
                    <p>This code will expire in 5 minutes.</p>
                    <p>If you didn't request this, please ignore this email.</p>
                </div>
            `,
        });

        if (error) {
            console.error("[Email] Failed to send OTP:", error);
            if (isProd) {
                throw new Error("Failed to send verification email");
            }
            console.warn(`[Email] OTP delivery fallback skipped for ${maskEmail(email)}.`);
            if (allowEmailOtpDebug) {
                console.warn(`[Email] OTP debug enabled for ${maskEmail(email)}.`);
            }
            return;
        }

        return data;
    } catch (e) {
        console.error("[Email] Exception sending OTP:", e);
        if (!isProd) {
            console.warn(`[Email] OTP delivery fallback skipped for ${maskEmail(email)}.`);
            if (allowEmailOtpDebug) {
                console.warn(`[Email] OTP debug enabled for ${maskEmail(email)}.`);
            }
            return;
        }
        throw e;
    }
};

export const sendInvite = async (email: string, role: string, appUrl: string) => {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
        console.warn(`[Email] RESEND_API_KEY is missing. Invite delivery skipped for ${maskEmail(email)}.`);
        return;
    }

    const resend = new Resend(apiKey);

    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: 'You have been invited to join a team on Workers Hive',
            html: `
                <h2>Welcome to Workers Hive!</h2>
                <p>You have been invited to join a team as a <strong>${role}</strong>.</p>
                <p>Please click the link below to securely log into your account using an Email OTP code:</p>
                <a href="${appUrl}/auth/login" style="display:inline-block;padding:12px 24px;background-color:#0f172a;color:white;text-decoration:none;border-radius:6px;margin-top:16px;">Log in to your account</a>
                <p style="margin-top:24px;font-size:12px;color:#64748b;">If you received this in error, please ignore this email.</p>
            `,
        });

        if (error) {
            console.error("[Email] Failed to send Invite:", error);
            throw new Error("Failed to send invite email");
        }

        return data;
    } catch (e) {
        console.error("[Email] Exception sending Invite:", e);
        if (process.env.NODE_ENV === "development") {
            console.warn(`[Email] Invite fallback skipped for ${maskEmail(email)}.`);
        }
    }
}
