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
