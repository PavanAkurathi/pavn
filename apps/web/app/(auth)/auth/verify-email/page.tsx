"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@repo/ui/components/ui/input-otp";
import { Card } from "@repo/ui/components/ui/card";
import { authClient } from "@repo/auth/client";
import { toast } from "sonner";
import { Suspense } from "react";

function VerifyEmailForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const email = searchParams.get("email");

    // Fallback if no email is provided in URL, though in production we might redirect back to login
    // we don't block render, just show error if submitting without email

    const [otp, setOtp] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleVerify = async () => {
        if (!email) {
            toast.error("No email address found. Please try signing up again.");
            return;
        }

        setIsLoading(true);
        await authClient.emailOtp.verifyEmail({
            email,
            otp,
        }, {
            onSuccess: () => {
                toast.success("Email verified successfully!");
                router.push("/dashboard");
            },
            onError: (ctx) => {
                toast.error(ctx.error.message);
                setIsLoading(false);
            }
        });
    };

    return (
        <Card className="py-8 px-4 shadow-none border-0 sm:border sm:shadow-sm sm:px-10 bg-white/50 sm:bg-white mt-8 flex flex-col items-center">
            <div className="mb-6 text-center">
                <p className="text-sm text-slate-500">
                    We sent a verification code to <span className="font-bold text-slate-700">{email}</span>.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                    Check your spam folder if you don't see it.
                </p>
            </div>

            <InputOTP
                maxLength={6}
                value={otp}
                onChange={(value) => setOtp(value)}
            >
                <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                </InputOTPGroup>
            </InputOTP>

            <Button
                className="w-full mt-6 bg-red-600 hover:bg-red-700 font-bold"
                onClick={handleVerify}
                disabled={isLoading || otp.length < 6}
            >
                {isLoading ? <Loader2 className="animate-spin" /> : "Verify Email"}
            </Button>
        </Card>
    );
}

export default function VerifyEmailPage() {
    return (
        <>
            <div className="text-center">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                    Verify your email
                </h2>
            </div>

            <Suspense fallback={<div className="mt-8 text-center text-sm text-slate-500">Loading...</div>}>
                <VerifyEmailForm />
            </Suspense>
        </>
    );
}
