"use client";

import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { toast } from "sonner";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { authClient } from "@repo/auth/client";
import { useRouter } from "next/navigation";

type AuthClientErrorContext = { error: { message: string } };

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
            onError: (ctx: AuthClientErrorContext) => {
                toast.error(ctx.error.message);
                setLoading(false);
            }
        });
    };

    return (
        <>
            <div className="text-center">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                    Reset your password
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                    Enter your email address and we'll send you a code to reset your password.
                </p>
            </div>

            <Card className="border bg-background/90 shadow-sm backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-xl">Email verification code</CardTitle>
                    <CardDescription>
                        We&apos;ll send a one-time code to the email address tied to your account.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                    <form onSubmit={onSubmit} className="flex flex-col gap-6">
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
                                    disabled={loading}
                                />
                            </Field>

                            <Button type="submit" disabled={loading} className="w-full">
                                {loading ? <Spinner data-icon="inline-start" /> : null}
                                Send reset code
                            </Button>
                        </FieldGroup>
                    </form>

                    <div>
                        <Link
                            href="/auth/login"
                            className="flex items-center justify-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </>
    );
}
