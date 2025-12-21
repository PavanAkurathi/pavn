"use client";

import { authClient } from "@repo/auth/client";
import { Card, CardHeader, CardTitle, CardContent } from "@repo/ui/components/ui/card";

export default function DashboardPage() {
    const { data: session } = authClient.useSession();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
                <p className="text-slate-500">Welcome back, {session?.user?.name}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Locations</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">1</div>
                        <p className="text-xs text-muted-foreground">Main Office</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Members</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">1</div>
                        <p className="text-xs text-muted-foreground">You (Admin)</p>
                    </CardContent>
                </Card>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-8 text-center">
                <h3 className="text-lg font-medium text-slate-900">Your organization is ready</h3>
                <p className="mt-2 text-slate-500 max-w-lg mx-auto">
                    You have successfully created your organization <strong>{session?.session?.activeOrganizationId}</strong>.
                    Start expecting more features here soon.
                </p>
            </div>
        </div>
    );
}
