"use client"

import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSeparator,
    InputOTPSlot,
} from "@repo/ui/components/ui/input-otp";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { toast } from "sonner";
import { useState } from "react";

export default function OTPPage() {
    const [loading, setLoading] = useState(false);
    const [value, setValue] = useState("");

    const onVerify = async () => {
        if (value.length < 6) {
            toast.error("Invalid Code", {
                description: "Please enter the full 6-digit code.",
            });
            return;
        }

        setLoading(true);
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setLoading(false);
        toast.success("Verified!", {
            description: "You have been successfully verified.",
        });
    };

    return (
        <>
            <div className="text-center">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                    Check your email
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                    We&apos;ve sent a 6-digit verification code to <span className="font-semibold text-foreground">name@venue.com</span>
                </p>
            </div>

            <Card className="border bg-background/90 shadow-sm backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-xl">Enter verification code</CardTitle>
                    <CardDescription>
                        Use the 6-digit code from your inbox to keep going.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-6">
                    <InputOTP
                        maxLength={6}
                        value={value}
                        onChange={(value) => setValue(value)}
                        disabled={loading}
                    >
                        <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                        </InputOTPGroup>
                        <InputOTPSeparator />
                        <InputOTPGroup>
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                        </InputOTPGroup>
                    </InputOTP>

                    <Button
                        onClick={onVerify}
                        disabled={loading}
                        className="w-full"
                    >
                        {loading ? <Spinner data-icon="inline-start" /> : null}
                        Verify code
                    </Button>

                    <div className="text-center text-sm">
                        <span className="text-muted-foreground">Didn&apos;t receive code?</span>{" "}
                        <button className="font-medium text-primary hover:text-primary/80">
                            Resend
                        </button>
                    </div>
                </CardContent>
            </Card>

            <div className="mt-6 text-center">
                <Link
                    href="/auth/login"
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                    Back to Login
                </Link>
            </div>
        </>
    );
}
