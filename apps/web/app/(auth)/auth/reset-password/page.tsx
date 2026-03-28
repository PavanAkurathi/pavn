"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { authClient } from "@repo/auth/client";
import { toast } from "sonner";
import { Suspense } from "react";
import { OtpForm } from "@/components/auth/otp-form";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/ui/field";
import { Spinner } from "@repo/ui/components/ui/spinner";

type AuthClientErrorContext = { error: { message: string } };

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
            onError: (ctx: AuthClientErrorContext) => {
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
        <Card className="border bg-background/90 shadow-sm backdrop-blur-sm">
            <CardContent className="flex flex-col items-center gap-6 pt-6">

            {!email && (
                <Alert variant="destructive">
                    <AlertTitle>Email missing</AlertTitle>
                    <AlertDescription>Please restart the password reset flow so we know which account to update.</AlertDescription>
                </Alert>
            )}

            {step === "otp" && (
                <>
                    <div className="text-center">
                        <p className="text-sm text-muted-foreground">
                            Enter the code sent to <span className="font-bold text-foreground">{email}</span>.
                        </p>
                    </div>
                    <OtpForm
                        value={otp}
                        onChange={setOtp}
                        onSubmit={handleVerifyOtp}
                        submitLabel="Verify code"
                    />
                </>
            )}

            {step === "password" && (
                <form onSubmit={handleResetPassword} className="flex w-full flex-col gap-6">
                    <div className="text-center">
                        <p className="text-2xl font-bold tracking-tight text-foreground">New password</p>
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
                                disabled={loading}
                            />
                        </Field>

                        <Button type="submit" disabled={loading} className="w-full">
                            {loading ? <Spinner data-icon="inline-start" /> : null}
                            Reset password
                        </Button>
                    </FieldGroup>
                </form>
            )}
            </CardContent>
        </Card>
    );
}

export default function ResetPasswordPage() {
    return (
        <>
            <div className="text-center">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                    Secure your account
                </h2>
            </div>
            <Suspense fallback={<div className="mt-8 text-center text-sm text-muted-foreground">Loading...</div>}>
                <ResetPasswordForm />
            </Suspense>
        </>
    );
}
