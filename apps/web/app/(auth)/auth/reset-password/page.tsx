"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Card } from "@repo/ui/components/ui/card";
import { authClient } from "@repo/auth/client";
import { toast } from "sonner";
import { Suspense } from "react";
import { OtpForm } from "@/components/auth/otp-form";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/ui/field";

function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const email = searchParams.get("email");

    const [otp, setOtp] = useState("");
    const [step, setStep] = useState<"otp" | "password">("otp");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleVerifyOtp = () => {
        if (otp.length < 6) return;
        setStep("password");
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            toast.error("Email missing from URL");
            return;
        }

        if (password !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }

        setLoading(true);

        await authClient.emailOtp.resetPassword({
            email,
            otp,
            password,
        }, {
            onSuccess: () => {
                toast.success("Password reset successfully!");
                router.push("/auth/login");
            },
            onError: (ctx) => {
                toast.error(ctx.error.message);
                setLoading(false);
                // If OTP is invalid, maybe go back? 
                if (ctx.error.message.toLowerCase().includes("code") || ctx.error.message.toLowerCase().includes("otp")) {
                    setStep("otp");
                }
            }
        });
    };

    return (
        <Card className="py-8 px-4 shadow-none border-0 sm:border sm:shadow-sm sm:px-10 bg-white/50 sm:bg-white mt-8 flex flex-col items-center">

            {!email && (
                <div className="mb-4 text-red-500 text-sm">Error: No email provided. Please restart functionality.</div>
            )}

            {step === "otp" && (
                <>
                    <div className="mb-6 text-center">
                        <p className="text-sm text-slate-500">
                            Enter the code sent to <span className="font-bold text-slate-700">{email}</span>.
                        </p>
                    </div>
                    <OtpForm
                        value={otp}
                        onChange={setOtp}
                        onSubmit={handleVerifyOtp}
                        submitLabel="Verify Code"
                    />
                </>
            )}

            {step === "password" && (
                <form onSubmit={handleResetPassword} className="w-full space-y-6">
                    <div className="text-center mb-4">
                        <p className="text-2xl font-bold tracking-tight text-slate-900">New Password</p>
                    </div>

                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="password">New Password</FieldLabel>
                            <Input
                                id="password"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="bg-white"
                                disabled={loading}
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="confirmPassword">Confirm Password</FieldLabel>
                            <Input
                                id="confirmPassword"
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="bg-white"
                                disabled={loading}
                            />
                        </Field>

                        <Button type="submit" disabled={loading} className="w-full bg-red-600 hover:bg-red-700 font-bold">
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin mr-2" /> Resetting...
                                </>
                            ) : (
                                "Reset Password"
                            )}
                        </Button>
                    </FieldGroup>
                </form>
            )}
        </Card>
    );
}

export default function ResetPasswordPage() {
    return (
        <>
            <div className="text-center">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                    Secure your account
                </h2>
            </div>
            <Suspense fallback={<div className="mt-8 text-center">Loading...</div>}>
                <ResetPasswordForm />
            </Suspense>
        </>
    );
}
