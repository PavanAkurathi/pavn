"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@repo/auth/client";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/ui/alert";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { acceptBusinessInvitation } from "@/actions/invites";

type AuthClientErrorContext = { error: { message: string } };

type BusinessInviteActivationCardProps = {
    invitationId: string;
    invitationEmail: string;
    invitationRole: string;
    organizationName: string;
    activationPath: string;
    hasExistingAccount: boolean;
    existingUserName?: string | null;
    currentUser: {
        email: string;
        emailVerified: boolean;
        name?: string | null;
    } | null;
};

export function BusinessInviteActivationCard({
    invitationId,
    invitationEmail,
    invitationRole,
    organizationName,
    activationPath,
    hasExistingAccount,
    existingUserName,
    currentUser,
}: BusinessInviteActivationCardProps) {
    const router = useRouter();
    const [isSigningUp, setIsSigningUp] = useState(false);
    const [isSendingVerification, setIsSendingVerification] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [password, setPassword] = useState("");
    const [formError, setFormError] = useState<string | null>(null);
    const [isAccepting, startAcceptTransition] = useTransition();

    const loginHref = useMemo(() => {
        const params = new URLSearchParams({ callbackURL: activationPath });
        return `/auth/login?${params.toString()}`;
    }, [activationPath]);

    const verifyHref = useMemo(() => {
        const params = new URLSearchParams({
            email: invitationEmail,
            callbackURL: activationPath,
        });
        return `/auth/verify-email?${params.toString()}`;
    }, [activationPath, invitationEmail]);

    const currentEmailMatches = currentUser?.email?.toLowerCase() === invitationEmail.toLowerCase();

    const handleCreateAccount = async (event: React.FormEvent) => {
        event.preventDefault();

        const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
        if (!fullName) {
            setFormError("Enter the invited person's name before continuing.");
            return;
        }

        if (password.length < 8) {
            setFormError("Use at least 8 characters for the password.");
            return;
        }

        setFormError(null);
        setIsSigningUp(true);

        await authClient.signUp.email({
            email: invitationEmail,
            password,
            name: fullName,
            callbackURL: activationPath,
        }, {
            onSuccess: () => {
                toast.success("Account created. Verify the email to finish joining the workspace.");
                router.push(verifyHref);
            },
            onError: (ctx: AuthClientErrorContext) => {
                setFormError(ctx.error.message);
                setIsSigningUp(false);
            },
        });
    };

    const handleSendVerificationCode = async () => {
        setIsSendingVerification(true);
        await authClient.emailOtp.sendVerificationOtp({
            email: invitationEmail,
            type: "email-verification",
        }, {
            onSuccess: () => {
                toast.success("Verification code sent.");
                router.push(verifyHref);
            },
            onError: (ctx: AuthClientErrorContext) => {
                toast.error(ctx.error.message);
                setIsSendingVerification(false);
            },
        });
    };

    const handleSignOut = async () => {
        setIsSigningOut(true);
        await authClient.signOut({
            fetchOptions: {
                onSuccess: () => {
                    toast.success("Signed out.");
                    router.refresh();
                },
                onError: () => {
                    setIsSigningOut(false);
                },
            },
        });
    };

    const handleAcceptInvitation = () => {
        startAcceptTransition(async () => {
            try {
                await acceptBusinessInvitation(invitationId);
                toast.success("Invitation accepted. Your workspace is ready.");
                router.push("/dashboard");
                router.refresh();
            } catch (error: any) {
                toast.error(error?.message || "We could not accept this invitation.");
            }
        });
    };

    if (currentUser && !currentEmailMatches) {
        return (
            <Card className="mt-8 shadow-sm">
                <CardHeader>
                    <CardTitle>Wrong account signed in</CardTitle>
                    <CardDescription>
                        This invitation is for <strong>{invitationEmail}</strong>, but you&apos;re signed in as <strong>{currentUser.email}</strong>.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert>
                        <AlertTitle>Use the invited email</AlertTitle>
                        <AlertDescription>
                            Sign out first, then continue with the invited business email so we can attach the right workspace membership.
                        </AlertDescription>
                    </Alert>
                </CardContent>
                <CardFooter className="flex gap-3">
                    <Button onClick={handleSignOut} disabled={isSigningOut}>
                        {isSigningOut ? <Spinner data-icon="inline-start" /> : null}
                        Sign out
                    </Button>
                    <Button variant="outline" asChild>
                        <Link href={loginHref}>Use invited email</Link>
                    </Button>
                </CardFooter>
            </Card>
        );
    }

    if (currentUser && !currentUser.emailVerified) {
        return (
            <Card className="mt-8 shadow-sm">
                <CardHeader>
                    <CardTitle>Verify email to continue</CardTitle>
                    <CardDescription>
                        Finish email verification for <strong>{invitationEmail}</strong> before accepting the {invitationRole} invitation to {organizationName}.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert>
                        <AlertTitle>One last step</AlertTitle>
                        <AlertDescription>
                            We&apos;ll send a fresh verification code, then bring you back here to accept the invitation.
                        </AlertDescription>
                    </Alert>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleSendVerificationCode} disabled={isSendingVerification}>
                        {isSendingVerification ? <Spinner data-icon="inline-start" /> : null}
                        Send verification code
                    </Button>
                </CardFooter>
            </Card>
        );
    }

    if (currentUser && currentEmailMatches) {
        return (
            <Card className="mt-8 shadow-sm">
                <CardHeader>
                    <CardTitle>Accept your invitation</CardTitle>
                    <CardDescription>
                        You&apos;re signed in as <strong>{currentUser.email}</strong>. Accept the {invitationRole} invitation to join {organizationName}.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Alert>
                        <AlertTitle>Access starts after acceptance</AlertTitle>
                        <AlertDescription>
                            Once you accept, the business workspace will be attached to your account and you&apos;ll be redirected into the app.
                        </AlertDescription>
                    </Alert>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleAcceptInvitation} disabled={isAccepting}>
                        {isAccepting ? <Spinner data-icon="inline-start" /> : null}
                        Accept invitation
                    </Button>
                </CardFooter>
            </Card>
        );
    }

    if (hasExistingAccount) {
        return (
            <Card className="mt-8 shadow-sm">
                <CardHeader>
                    <CardTitle>Sign in to continue</CardTitle>
                    <CardDescription>
                        {existingUserName ? `${existingUserName} already has an account.` : "This email already has a Workers Hive account."} Sign in with <strong>{invitationEmail}</strong> to review the invitation to {organizationName}.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Alert>
                        <AlertTitle>Existing account detected</AlertTitle>
                        <AlertDescription>
                            We&apos;ll bring you back to this invitation automatically after sign-in so you can accept it in one step.
                        </AlertDescription>
                    </Alert>
                </CardContent>
                <CardFooter className="flex gap-3">
                    <Button asChild>
                        <Link href={loginHref}>Sign in with invited email</Link>
                    </Button>
                    <Button variant="outline" asChild>
                        <Link href="/auth/forgot-password">Reset password</Link>
                    </Button>
                </CardFooter>
            </Card>
        );
    }

    return (
        <Card className="mt-8 shadow-sm">
            <CardHeader>
                <CardTitle>Create your access</CardTitle>
                <CardDescription>
                    Set a password for <strong>{invitationEmail}</strong>, verify the email, then accept the {invitationRole} invitation to {organizationName}.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleCreateAccount} className="flex flex-col gap-6">
                    <FieldGroup>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field data-invalid={Boolean(formError)}>
                                <FieldLabel htmlFor="invite_first_name">First name</FieldLabel>
                                <Input
                                    id="invite_first_name"
                                    autoComplete="given-name"
                                    value={firstName}
                                    onChange={(event) => setFirstName(event.target.value)}
                                    disabled={isSigningUp}
                                />
                            </Field>
                            <Field data-invalid={Boolean(formError)}>
                                <FieldLabel htmlFor="invite_last_name">Last name</FieldLabel>
                                <Input
                                    id="invite_last_name"
                                    autoComplete="family-name"
                                    value={lastName}
                                    onChange={(event) => setLastName(event.target.value)}
                                    disabled={isSigningUp}
                                />
                            </Field>
                        </div>

                        <Field>
                            <FieldLabel htmlFor="invite_email">Invited email</FieldLabel>
                            <Input
                                id="invite_email"
                                value={invitationEmail}
                                readOnly
                                disabled
                            />
                        </Field>

                        <Field data-invalid={Boolean(formError)}>
                            <FieldLabel htmlFor="invite_password">Password</FieldLabel>
                            <Input
                                id="invite_password"
                                type="password"
                                autoComplete="new-password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                disabled={isSigningUp}
                            />
                            {formError ? <FieldError error={formError} /> : null}
                        </Field>
                    </FieldGroup>

                    <Button type="submit" disabled={isSigningUp}>
                        {isSigningUp ? <Spinner data-icon="inline-start" /> : null}
                        Create account and continue
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
