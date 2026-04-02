"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { authClient } from "@repo/auth/client";
import { useRouter, useSearchParams } from "next/navigation";

type AuthClientErrorContext = { error: { message: string } };

function ForgotPasswordContent() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackURL = searchParams.get("callbackURL");
    const safeCallbackURL = callbackURL && callbackURL.startsWith("/") ? callbackURL : null;

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
                const nextUrl = new URL("/auth/reset-password", window.location.origin);
                nextUrl.searchParams.set("email", email);
                if (safeCallbackURL) {
                    nextUrl.searchParams.set("callbackURL", safeCallbackURL);
                }
                router.push(`${nextUrl.pathname}${nextUrl.search}`);
            },
            onError: (ctx: AuthClientErrorContext) => {
                toast.error(ctx.error.message);
                setLoading(false);
            }
        });
    };

    return (
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
                        href={safeCallbackURL
                            ? `/auth/login?callbackURL=${encodeURIComponent(safeCallbackURL)}`
                            : "/auth/login"}
                        className="flex items-center justify-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}

export default function ForgotPasswordPage() {
    return (
        <>
            <div className="text-center">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                    Reset your password
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                    Enter your email address and we&apos;ll send you a code to reset your password.
                </p>
            </div>

            <Suspense fallback={<div className="mt-8 text-center text-sm text-muted-foreground">Loading...</div>}>
                <ForgotPasswordContent />
            </Suspense>
        </>
    );
}
