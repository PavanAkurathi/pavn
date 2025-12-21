"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Card } from "@repo/ui/components/ui/card";
import {
    Field,
    FieldGroup,
    FieldLabel,
} from "@repo/ui/components/ui/field";
import { authClient } from "@repo/auth/client";
import { toast } from "sonner";

export default function SignupPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    // Form State
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [businessName, setBusinessName] = useState("");
    const [password, setPassword] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const fullName = `${firstName.trim()} ${lastName.trim()}`;

        await authClient.signUp.email({
            email,
            password,
            name: fullName,
            // @ts-ignore
            phoneNumber: phone,
            image: undefined,
            // Pass companyName in the body for our custom hook
            // @ts-ignore - Better Auth client allows extra props but TS might complain without generics
            companyName: businessName,
            callbackURL: "/dashboard", // Redirect to dashboard after signup
        }, {
            onRequest: () => {
                setIsLoading(true);
            },
            onSuccess: () => {
                toast.success("Account created! Please verify your email.");
                router.push(`/auth/verify-email?email=${encodeURIComponent(email)}`);
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
                    Create an account
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                    Already have an account?{" "}
                    <Link
                        href="/auth/login"
                        className="font-medium text-red-600 hover:text-red-500 transition-colors"
                    >
                        Sign in
                    </Link>
                </p>
            </div>

            <Card className="py-8 px-4 shadow-none border-0 sm:border sm:shadow-sm sm:px-10 bg-white/50 sm:bg-white mt-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <FieldGroup>
                        <div className="grid grid-cols-2 gap-4">
                            <Field>
                                <FieldLabel htmlFor="first_name">First name</FieldLabel>
                                <Input
                                    id="first_name"
                                    name="first_name"
                                    type="text"
                                    autoComplete="given-name"
                                    required
                                    className="bg-white"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="last_name">Last name</FieldLabel>
                                <Input
                                    id="last_name"
                                    name="last_name"
                                    type="text"
                                    autoComplete="family-name"
                                    required
                                    className="bg-white"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                />
                            </Field>
                        </div>

                        <Field>
                            <FieldLabel htmlFor="email">Work email</FieldLabel>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                placeholder="managers@venue.com"
                                className="bg-white"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </Field>

                        <Field>
                            <FieldLabel htmlFor="phone">Phone Number</FieldLabel>
                            <Input
                                id="phone"
                                name="phone"
                                type="tel"
                                autoComplete="tel"
                                required
                                placeholder="(555) 123-4567"
                                className="bg-white"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                            />
                        </Field>

                        <Field>
                            <FieldLabel htmlFor="business_name">Business Name</FieldLabel>
                            <Input
                                id="business_name"
                                name="business_name"
                                type="text"
                                required
                                placeholder="e.g. Joe's Coffee House"
                                className="bg-white"
                                value={businessName}
                                onChange={(e) => setBusinessName(e.target.value)}
                            />
                        </Field>

                        <Field>
                            <FieldLabel htmlFor="password">Password</FieldLabel>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="new-password"
                                required
                                placeholder="Min 8 characters"
                                className="bg-white"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </Field>

                        <div className="space-y-3 pt-2">
                            <div className="flex items-start">
                                <CheckCircle2 className="h-5 w-5 text-green-500 mr-2 shrink-0" />
                                <p className="text-sm text-slate-500">
                                    <span className="font-bold text-slate-700">14-day free trial</span> with full access.
                                </p>
                            </div>
                            <div className="flex items-start">
                                <CheckCircle2 className="h-5 w-5 text-green-500 mr-2 shrink-0" />
                                <p className="text-sm text-slate-500">
                                    <span className="font-bold text-slate-700">No credit card required</span> to start.
                                </p>
                            </div>
                        </div>

                        <div>
                            <Button
                                type="submit"
                                className="w-full bg-red-600 hover:bg-red-700 font-bold h-12 text-lg"
                                disabled={isLoading}
                            >
                                {isLoading ? <div className="flex items-center gap-2"><Loader2 className="animate-spin" /> Creating...</div> : "Create Account"}
                            </Button>
                        </div>

                        <p className="text-xs text-center text-slate-500">
                            By creating an account, you agree to our{" "}
                            <Link href="/terms" className="underline hover:text-slate-700">Terms</Link>{" "}
                            and{" "}
                            <Link href="/privacy" className="underline hover:text-slate-700">Privacy Policy</Link>.
                        </p>
                    </FieldGroup>
                </form>
            </Card>
        </>
    );
}
