"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import {
    Field,
    FieldGroup,
    FieldLabel,
    FieldError,
} from "@repo/ui/components/ui/field";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { authClient } from "@repo/auth/client";
import { toast } from "sonner";
import { useForm, Controller } from "@repo/ui/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { SUBSCRIPTION } from "@repo/config";

type AuthClientErrorContext = { error: { message: string } };

const signupSchema = z.object({
    firstName: z.string().min(2, "First name must be at least 2 characters"),
    lastName: z.string().min(2, "Last name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email address"),
    phone: z.string().trim().regex(/^\+?1?\s*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/, "Must be a valid US/Canada phone number"),
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
            onError: (ctx: AuthClientErrorContext) => {
                toast.error(ctx.error.message);
                setIsLoading(false);
            }
        });
    };

    return (
        <Card className="mt-8 shadow-sm">
            <CardHeader>
                <CardTitle>Create your business account</CardTitle>
                <CardDescription>
                    Start your workspace now. We&apos;ll handle business setup after your account is created.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
                    <FieldGroup>
                        <div className="grid gap-4 sm:grid-cols-2">
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
                                    <FieldLabel htmlFor="phone">Phone number</FieldLabel>
                                    <Input
                                        {...field}
                                        id="phone"
                                        type="tel"
                                        autoComplete="tel"
                                        placeholder="(555) 123-4567"
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
                                    <FieldLabel htmlFor="businessName">Business name</FieldLabel>
                                    <Input
                                        {...field}
                                        id="businessName"
                                        placeholder="e.g. Joe's Coffee House"
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
                                        aria-invalid={fieldState.invalid}
                                    />
                                    {fieldState.invalid && <FieldError error={fieldState.error?.message} />}
                                </Field>
                            )}
                        />
                    </FieldGroup>

                    <Alert>
                        <AlertTitle>Free trial included</AlertTitle>
                        <AlertDescription className="flex flex-col gap-2">
                            <p><strong>{SUBSCRIPTION.TRIAL_DAYS}-day free trial</strong> with full access.</p>
                            <p><strong>No credit card required</strong> to start.</p>
                        </AlertDescription>
                    </Alert>

                    <Button
                        type="submit"
                        size="lg"
                        className="w-full"
                        disabled={isLoading}
                    >
                        {isLoading ? <Spinner data-icon="inline-start" /> : null}
                        {isLoading ? "Creating account" : "Create account"}
                    </Button>
                </form>
            </CardContent>
            <CardFooter>
                <p className="text-center text-xs text-muted-foreground">
                    By creating an account, you agree to our{" "}
                    <Link href="/terms" className="underline underline-offset-4">
                        Terms
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="underline underline-offset-4">
                        Privacy Policy
                    </Link>.
                </p>
            </CardFooter>
        </Card>
    );
}
