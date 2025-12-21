"use client"

import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSeparator,
    InputOTPSlot,
} from "@repo/ui/components/ui/input-otp";
import { Card } from "@repo/ui/components/ui/card";
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
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                    Check your email
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                    We've sent a 6-digit verification code to <span className="font-semibold text-slate-900">name@venue.com</span>
                </p>
            </div>

            <Card className="py-8 px-4 shadow-none border-0 sm:border sm:shadow-sm sm:px-10 bg-white/50 sm:bg-white mt-8 flex flex-col items-center">
                <div className="space-y-6 w-full flex flex-col items-center">
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
                        className="w-full bg-red-600 hover:bg-red-700 font-bold"
                    >
                        {loading ? (
                            <>
                                <Spinner className="mr-2 text-white" /> Verifying...
                            </>
                        ) : (
                            "Verify Code"
                        )}
                    </Button>

                    <div className="text-center text-sm">
                        <span className="text-slate-500">Didn't receive code?</span>{" "}
                        <button className="font-medium text-red-600 hover:text-red-500">
                            Result
                        </button>
                    </div>
                </div>
            </Card>

            <div className="mt-6 text-center">
                <Link
                    href="/auth/login"
                    className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                    Back to Login
                </Link>
            </div>
        </>
    );
}
