"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import {
    Field,
    FieldGroup,
    FieldLabel,
} from "@repo/ui/components/ui/field";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { authClient } from "@repo/auth/client";
import { toast } from "sonner";

type AuthClientErrorContext = { error: { message: string } };

export function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);
    const callbackURL = searchParams.get("callbackURL");
    const safeCallbackURL = callbackURL && callbackURL.startsWith("/") ? callbackURL : "/dashboard";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        await authClient.signIn.email({
            email,
            password,
            rememberMe,
            callbackURL: safeCallbackURL,
        }, {
            onRequest: () => {
                setIsLoading(true);
            },
            onSuccess: () => {
                // Track login
                // posthog.identify(email);
                // posthog.capture('login_completed', { method: 'email' });

                toast.success("Welcome back!");
                router.push(safeCallbackURL);
            },
            onError: (ctx: AuthClientErrorContext) => {
                toast.error(ctx.error.message);
                setIsLoading(false);
            }
        });
    };

    return (
        <Card className="mt-8 shadow-sm">
            <CardHeader>
                <CardTitle>Sign in to Workers Hive</CardTitle>
                <CardDescription>
                    Use your business email and password to continue to your workspace.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
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
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </Field>

                        <Field>
                            <FieldLabel htmlFor="password">Password</FieldLabel>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </Field>

                        <div className="flex items-center justify-between gap-3 pt-1">
                            <Field orientation="horizontal" className="gap-2">
                                <Checkbox
                                    id="remember_me"
                                    checked={rememberMe}
                                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                                />
                                <FieldLabel htmlFor="remember_me" className="text-sm font-normal">
                                    Remember me
                                </FieldLabel>
                            </Field>

                            <Link
                                href={safeCallbackURL === "/dashboard"
                                    ? "/auth/forgot-password"
                                    : `/auth/forgot-password?callbackURL=${encodeURIComponent(safeCallbackURL)}`}
                                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                            >
                                Forgot password?
                            </Link>
                        </div>
                    </FieldGroup>

                    <Button
                        type="submit"
                        className="w-full"
                        size="lg"
                        disabled={isLoading}
                    >
                        {isLoading ? <Spinner data-icon="inline-start" /> : null}
                        Sign in
                    </Button>
                </form>
            </CardContent>
            <CardFooter>
                <p className="text-sm text-muted-foreground">
                    New to Workers Hive?{" "}
                    <Link href="/auth/signup" className="font-medium text-primary underline-offset-4 hover:underline">
                        Create an account
                    </Link>
                    .
                </p>
            </CardFooter>
        </Card>
    );
}
