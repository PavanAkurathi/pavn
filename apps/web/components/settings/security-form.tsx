"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import { Laptop, Smartphone, Globe, Shield, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/ui/alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@repo/ui/components/ui/empty";
import { format } from "date-fns";
import { authClient } from "@repo/auth/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface SecurityFormProps {
    sessions: any[];
    accounts: any[];
}

export function SecurityForm({ sessions, accounts }: SecurityFormProps) {
    const router = useRouter();
    const { data: currentSession } = authClient.useSession();

    // Helper to determine icon based on user agent
    const getDeviceIcon = (userAgent: string | null) => {
        if (!userAgent) return <Globe className="h-5 w-5" />;
        if (userAgent.toLowerCase().includes("mobile")) return <Smartphone className="h-5 w-5" />;
        return <Laptop className="h-5 w-5" />;
    };

    const handleSignOutSession = async (token: string) => {
        try {
            await authClient.revokeSession({ token });
            toast.success("Session revoked");
            router.refresh();
        } catch {
            // If revokeSession isn't available in this auth version, disable gracefully
            toast.error("Unable to revoke session. Try signing out from that device.");
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Connected Accounts</CardTitle>
                    <CardDescription>
                        Manage the accounts linked to your profile.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    {accounts.length === 0 ? (
                        <Empty className="border border-dashed">
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <AlertCircle />
                                </EmptyMedia>
                                <EmptyTitle>Password-based authentication</EmptyTitle>
                                <EmptyDescription>
                                    You are currently using email and password sign-in only.
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {accounts.map((account) => (
                                <div key={account.id} className="flex items-center justify-between p-3 border rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-full bg-primary/10 p-2">
                                            <Shield className="h-4 w-4 text-primary" />
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-medium capitalize">{account.providerId}</span>
                                            <span className="text-xs text-muted-foreground">Connected {format(new Date(account.createdAt), 'MMM d, yyyy')}</span>
                                        </div>
                                    </div>
                                    <Badge variant="secondary">
                                        Connected
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Active Sessions</CardTitle>
                    <CardDescription>
                        Devices where you are currently logged in.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    {sessions.length === 0 ? (
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>No active sessions</AlertTitle>
                            <AlertDescription>
                                We could not find any other active sessions for this account.
                            </AlertDescription>
                        </Alert>
                    ) : sessions.map((session) => {
                        const isCurrent = currentSession?.session?.token === session.token;
                        return (
                            <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="flex items-center gap-4">
                                    <div className="rounded-full bg-muted p-2 text-muted-foreground">
                                        {getDeviceIcon(session.userAgent)}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium text-sm">
                                                {session.ipAddress || "Unknown IP"}
                                            </p>
                                            {isCurrent && (
                                                <Badge variant="default" className="h-5 px-1.5 text-[10px]">
                                                    Current Device
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-[300px]">
                                            {session.userAgent}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Started {format(new Date(session.createdAt), 'MMM d, yyyy HH:mm')}
                                        </p>
                                    </div>
                                </div>
                                {!isCurrent && (
                                    <Button variant="ghost" size="sm" onClick={() => handleSignOutSession(session.token)}>
                                        Revoke
                                    </Button>
                                )}
                            </div>
                        );
                    })}
                </CardContent>
            </Card>
        </div>
    );
}
