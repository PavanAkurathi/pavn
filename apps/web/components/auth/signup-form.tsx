"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import posthog from "posthog-js";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Card } from "@repo/ui/components/ui/card";
import {
    Field,
    FieldGroup,
    FieldLabel,
    FieldError,
} from "@repo/ui/components/ui/field";
import { authClient } from "@repo/auth/client";
import { toast } from "sonner";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PRICING } from "@repo/config";

const signupSchema = z.object({
    firstName: z.string().min(2, "First name must be at least 2 characters"),
    lastName: z.string().min(2, "Last name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email address"),
    phone: z.string().min(10, "Please enter a valid phone number"),
    businessName: z.string().min(2, "Business name must be at least 2 characters"),
    password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export function SignupForm() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<SignupFormValues>({
        resolver: zodResolver(signupSchema),
        defaultValues: {
            firstName: "",
            lastName: "",
            email: "",
            phone: "",
            businessName: "",
            password: "",
        },
    });

    const onSubmit = async (data: SignupFormValues) => {
        setIsLoading(true);

        const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`;

        await authClient.signUp.email({
            email: data.email,
            password: data.password,
            name: fullName,
            // @ts-ignore
            phoneNumber: data.phone,
            image: undefined,
            // Pass companyName in the body for our custom hook
            // @ts-ignore - Better Auth client allows extra props but TS might complain without generics
            companyName: data.businessName,
            callbackURL: "/dashboard", // Redirect to dashboard after signup
        }, {
            onRequest: () => {
                setIsLoading(true);
            },
            onSuccess: async () => {
                // Track signup event
                posthog.identify(data.email, {
                    email: data.email,
                    name: fullName,
                    phone: data.phone,
                    company_name: data.businessName
                });

                posthog.capture('signup_completed', {
                    method: 'email',
                    company_name: data.businessName
                });

                toast.success("Account created! Please verify your email.");
                router.push(`/auth/verify-email?email=${encodeURIComponent(data.email)}`);
            },
            onError: (ctx) => {
                toast.error(ctx.error.message);
                setIsLoading(false);
            }
        });
    };

    return (
        <Card className="py-8 px-4 shadow-none border-0 sm:border sm:shadow-sm sm:px-10 bg-white/50 sm:bg-white mt-8">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FieldGroup>
                    <div className="grid grid-cols-2 gap-4">
                        <Controller
                            control={form.control}
                            name="firstName"
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="firstName">First name</FieldLabel>
                                    <Input
                                        {...field}
                                        id="firstName"
                                        autoComplete="given-name"
                                        className="bg-white"
                                        aria-invalid={fieldState.invalid}
                                    />
                                    {fieldState.invalid && <FieldError error={fieldState.error?.message} />}
                                </Field>
                            )}
                        />
                        <Controller
                            control={form.control}
                            name="lastName"
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="lastName">Last name</FieldLabel>
                                    <Input
                                        {...field}
                                        id="lastName"
                                        autoComplete="family-name"
                                        className="bg-white"
                                        aria-invalid={fieldState.invalid}
                                    />
                                    {fieldState.invalid && <FieldError error={fieldState.error?.message} />}
                                </Field>
                            )}
                        />
                    </div>

                    <Controller
                        control={form.control}
                        name="email"
                        render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor="email">Work email</FieldLabel>
                                <Input
                                    {...field}
                                    id="email"
                                    type="email"
                                    autoComplete="email"
                                    placeholder="managers@venue.com"
                                    className="bg-white"
                                    aria-invalid={fieldState.invalid}
                                />
                                {fieldState.invalid && <FieldError error={fieldState.error?.message} />}
                            </Field>
                        )}
                    />

                    <Controller
                        control={form.control}
                        name="phone"
                        render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor="phone">Phone Number</FieldLabel>
                                <Input
                                    {...field}
                                    id="phone"
                                    type="tel"
                                    autoComplete="tel"
                                    placeholder="(555) 123-4567"
                                    className="bg-white"
                                    aria-invalid={fieldState.invalid}
                                />
                                {fieldState.invalid && <FieldError error={fieldState.error?.message} />}
                            </Field>
                        )}
                    />

                    <Controller
                        control={form.control}
                        name="businessName"
                        render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor="businessName">Business Name</FieldLabel>
                                <Input
                                    {...field}
                                    id="businessName"
                                    placeholder="e.g. Joe's Coffee House"
                                    className="bg-white"
                                    aria-invalid={fieldState.invalid}
                                />
                                {fieldState.invalid && <FieldError error={fieldState.error?.message} />}
                            </Field>
                        )}
                    />

                    <Controller
                        control={form.control}
                        name="password"
                        render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor="password">Password</FieldLabel>
                                <Input
                                    {...field}
                                    id="password"
                                    type="password"
                                    autoComplete="new-password"
                                    placeholder="Min 8 characters"
                                    className="bg-white"
                                    aria-invalid={fieldState.invalid}
                                />
                                {fieldState.invalid && <FieldError error={fieldState.error?.message} />}
                            </Field>
                        )}
                    />

                    <div className="space-y-3 pt-2">
                        <div className="flex items-start">
                            <CheckCircle2 className="h-5 w-5 text-green-500 mr-2 shrink-0" />
                            <p className="text-sm text-slate-500">
                                <span className="font-bold text-slate-700">{PRICING.TRIAL_DAYS}-day free trial</span> with full access.
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
    );
}
