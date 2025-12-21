"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Card } from "@repo/ui/components/ui/card";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import {
    Field,
    FieldGroup,
    FieldLabel,
} from "@repo/ui/components/ui/field";
import { authClient } from "@repo/auth/client";
import { toast } from "sonner";

export default function LoginPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        await authClient.signIn.email({
            email,
            password,
            rememberMe,
            callbackURL: "/dashboard",
        }, {
            onRequest: () => {
                setIsLoading(true);
            },
            onSuccess: () => {
                toast.success("Welcome back!");
                router.push("/dashboard");
            },
            onError: (ctx) => {
                toast.error(ctx.error.message);
                setIsLoading(false);
            }
        });
    };

    return (
        <>
            <div className="text-center">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                    Welcome back
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                    Don't have an account?{" "}
                    <Link
                        href="/auth/signup"
                        className="font-medium text-red-600 hover:text-red-500 transition-colors"
                    >
                        Start free trial
                    </Link>
                </p>
            </div>

            <Card className="py-8 px-4 shadow-none border-0 sm:border sm:shadow-sm sm:px-10 bg-white/50 sm:bg-white mt-8">
                <form onSubmit={handleSubmit} className="space-y-6">
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
                                className="bg-white"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </Field>

                        <div className="flex items-center justify-between pt-2">
                            <Field orientation="horizontal" className="gap-2">
                                <Checkbox
                                    id="remember_me"
                                    checked={rememberMe}
                                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                                />
                                <FieldLabel htmlFor="remember_me" className="font-normal text-slate-900 text-sm">
                                    Remember me
                                </FieldLabel>
                            </Field>

                            <div className="text-sm">
                                <Link
                                    href="/auth/forgot-password"
                                    className="font-medium text-red-600 hover:text-red-500"
                                >
                                    Forgot password?
                                </Link>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full bg-red-600 hover:bg-red-700 font-bold"
                            disabled={isLoading}
                        >
                            {isLoading ? <Loader2 className="animate-spin" /> : "Sign in"}
                        </Button>
                    </FieldGroup>
                </form>
            </Card>
        </>
    );
}
