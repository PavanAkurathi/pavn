import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import {
    buildBusinessActivationPath,
    getBusinessInvitationState,
} from "@/lib/server/business-invitations";
import { BusinessInviteActivationCard } from "@/components/auth/business-invite-activation-card";

type SearchParams = Promise<{
    invitationId?: string;
}>;

export default async function ActivateInvitationPage(props: { searchParams: SearchParams }) {
    const searchParams = await props.searchParams;
    const invitationId = searchParams.invitationId;

    if (!invitationId) {
        return (
            <>
                <div className="text-center">
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">
                        Invitation link missing
                    </h2>
                </div>

                <Card className="mt-8 shadow-sm">
                    <CardHeader>
                        <CardTitle>We need an invitation link</CardTitle>
                        <CardDescription>
                            Open the invitation from your email or ask the business admin to resend it.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <Button asChild>
                            <Link href="/auth/login">Back to login</Link>
                        </Button>
                    </CardFooter>
                </Card>
            </>
        );
    }

    const [session, invitationState] = await Promise.all([
        auth.api.getSession({ headers: await headers() }),
        getBusinessInvitationState(invitationId),
    ]);

    if (!invitationState || invitationState.isExpired) {
        return (
            <>
                <div className="text-center">
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">
                        Invitation unavailable
                    </h2>
                </div>

                <Card className="mt-8 shadow-sm">
                    <CardHeader>
                        <CardTitle>This invite is no longer active</CardTitle>
                        <CardDescription>
                            The invitation may have expired, been accepted already, or been canceled. Ask the business admin for a fresh invite if you still need access.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            Workers Hive only grants business access from a live pending invitation.
                        </p>
                    </CardContent>
                    <CardFooter>
                        <Button asChild>
                            <Link href="/auth/login">Back to login</Link>
                        </Button>
                    </CardFooter>
                </Card>
            </>
        );
    }

    return (
        <>
            <div className="text-center">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                    Join {invitationState.organizationName}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                    This invitation grants <span className="font-medium text-foreground">{invitationState.role}</span> access for <span className="font-medium text-foreground">{invitationState.email}</span>.
                </p>
            </div>

            <BusinessInviteActivationCard
                invitationId={invitationState.id}
                invitationEmail={invitationState.email}
                invitationRole={invitationState.role}
                organizationName={invitationState.organizationName}
                activationPath={buildBusinessActivationPath(invitationState.id)}
                hasExistingAccount={Boolean(invitationState.existingUserId)}
                existingUserName={invitationState.existingUserName}
                currentUser={session ? {
                    email: session.user.email,
                    emailVerified: session.user.emailVerified,
                    name: session.user.name,
                } : null}
            />
        </>
    );
}
