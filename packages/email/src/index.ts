import { Resend } from 'resend';
import { OtpEmail } from './templates/otp';

// Initialize Resend with API Key from environment
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "onboarding@resend.dev"; // Default for testing, change to your domain in prod

export const sendOtp = async (email: string, otp: string) => {
    if (!process.env.RESEND_API_KEY) {
        console.warn("[Email] RESEND_API_KEY is missing. Logging OTP instead.");
        console.log(`[Email] To: ${email}, OTP: ${otp}`);
        return;
    }

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
