"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@repo/ui/components/ui/button";
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@repo/ui/components/ui/input-otp";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { authClient } from "@repo/auth/client";
import { toast } from "sonner";
import { Suspense } from "react";
import { Spinner } from "@repo/ui/components/ui/spinner";

type AuthClientErrorContext = { error: { message: string } };

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
            onError: (ctx: AuthClientErrorContext) => {
                toast.error(ctx.error.message);
                setIsLoading(false);
            }
        });
    };

    return (
        <Card className="border bg-background/90 shadow-sm backdrop-blur-sm">
            <CardHeader>
                <CardTitle className="text-xl">Enter verification code</CardTitle>
                <CardDescription>
                    We sent a verification code to <span className="font-semibold text-foreground">{email}</span>. Check your spam folder if you don&apos;t see it.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-6">
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
                    className="w-full"
                    onClick={handleVerify}
                    disabled={isLoading || otp.length < 6}
                >
                    {isLoading ? <Spinner data-icon="inline-start" /> : null}
                    Verify email
                </Button>
            </CardContent>
        </Card>
    );
}

export default function VerifyEmailPage() {
    return (
        <>
            <div className="text-center">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                    Verify your email
                </h2>
            </div>

            <Suspense fallback={<div className="mt-8 text-center text-sm text-muted-foreground">Loading...</div>}>
                <VerifyEmailForm />
            </Suspense>
        </>
    );
}
