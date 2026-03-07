import { Resend } from 'resend';
import { OtpEmail } from './templates/otp';

// Initialize Resend with API Key from environment
const FROM_EMAIL = process.env.EMAIL_FROM || "onboarding@resend.dev"; // Use EMAIL_FROM env var or fallback to default

export const sendOtp = async (email: string, otp: string) => {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
        console.warn("[Email] RESEND_API_KEY is missing. Logging OTP instead.");
        console.log(`[Email] To: ${email}, OTP: ${otp}`);
        return;
    }

    const resend = new Resend(apiKey);

    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: 'Your Verification Code',
            react: OtpEmail({ otp }) as any,
        });

        if (error) {
            console.error("[Email] Failed to send OTP:", error);
            throw new Error("Failed to send verification email");
        }

        return data;
    } catch (e) {
        console.error("[Email] Exception sending OTP:", e);
        // Fallback log for dev if email fails
        if (process.env.NODE_ENV === "development") {
            console.log(`[Email Fallback] To: ${email}, OTP: ${otp}`);
        }
    }
};

export const sendInvite = async (email: string, role: string, appUrl: string) => {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
        console.warn("[Email] RESEND_API_KEY is missing. Logging Invite instead.");
        console.log(`[Email Invite] To: ${email}, Role: ${role}, Link: ${appUrl}`);
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
            console.log(`[Email Invite Fallback] To: ${email}`);
        }
    }
}
