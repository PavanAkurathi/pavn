"use client";

import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/ui/field";
import { Card } from "@repo/ui/components/ui/card";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { toast } from "sonner";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { authClient } from "@repo/auth/client";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const email = formData.get("email") as string;

        await authClient.emailOtp.sendVerificationOtp({
            email,
            type: "forget-password",
        }, {
            onSuccess: () => {
                toast.success("Code sent!", {
                    description: "Check your email for the verification code.",
                });
                router.push(`/auth/reset-password?email=${encodeURIComponent(email)}`);
            },
            onError: (ctx) => {
                toast.error(ctx.error.message);
                setLoading(false);
            }
        });
    };

    return (
        <>
            <div className="text-center">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                    Reset your password
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                    Enter your email address and we'll send you a code to reset your password.
                </p>
            </div>

            <Card className="py-8 px-4 shadow-none border-0 sm:border sm:shadow-sm sm:px-10 bg-white/50 sm:bg-white mt-8">
                <form onSubmit={onSubmit} className="space-y-6">
                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="email">Email address</FieldLabel>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                placeholder="name@venue.com"
                                className="bg-white"
                                disabled={loading}
                            />
                        </Field>

                        <Button type="submit" disabled={loading} className="w-full bg-red-600 hover:bg-red-700 font-bold">
                            {loading ? (
                                <>
                                    <Spinner className="mr-2 text-white" /> Sending...
                                </>
                            ) : (
                                "Send Reset Code"
                            )}
                        </Button>
                    </FieldGroup>
                </form>

                <div className="mt-6">
                    <Link
                        href="/auth/login"
                        className="flex items-center justify-center text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
                    </Link>
                </div>
            </Card>
        </>
    );
}
