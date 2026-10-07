import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { ArrowLeft, Phone, Mail, KeyRound, HelpCircle } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { AvailabilityList } from "@/components/workers/availability-list";
import { getRequiredOrganizationContext } from "@/lib/server/auth-context";
import { getWorkerProfile } from "@/lib/api/organizations";

const STATUS_LABEL: Record<string, string> = {
    added: "Not invited",
    invited: "Invite sent",
    active: "On the app",
    inactive: "Inactive",
};

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function WorkerProfilePage({ params }: PageProps) {
    const { id } = await params;

    const { activeOrgId } = await getRequiredOrganizationContext();

    let profile;
    try {
        profile = await getWorkerProfile(id, activeOrgId);
    } catch {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <HelpCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h2 className="text-xl font-semibold">Worker not found</h2>
                <p className="text-muted-foreground mb-6">This worker does not exist or has been removed from your organization.</p>
                <Link href="/workers">
                    <Button variant="outline">Back to Team</Button>
                </Link>
            </div>
        );
    }

    const { displayData, roles } = profile;

    return (
        <div className="max-w-4xl space-y-8">
            {/* Header / Breadcrumb */}
            <div className="flex items-center gap-4">
                <Link href="/workers">
                    <Button variant="ghost" size="icon" className="rounded-full">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Worker Profile</h2>
                    <p className="text-muted-foreground">Manage details, roles, and rates for this worker.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column: Identity & Contact */}
                <div className="md:col-span-1 space-y-6">
                    <Card>
                        <CardHeader className="items-center text-center">
                            <Avatar className="h-24 w-24 mb-2">
                                <AvatarImage src={displayData.image || undefined} alt={displayData.name} />
                                <AvatarFallback className="text-2xl">{displayData.name.charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <CardTitle className="text-xl">{displayData.name}</CardTitle>
                            <CardDescription>Joined {format(new Date(displayData.joinedAt), "MMM d, yyyy")}</CardDescription>

                            <Badge
                                variant={displayData.status === "active" ? "default" : "outline"}
                                className={displayData.status === "active" ? "bg-green-500 mt-2" : "mt-2"}
                            >
                                {STATUS_LABEL[displayData.status] ?? displayData.status}
                            </Badge>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-3 text-sm">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span>{displayData.phone || "No phone number"}</span>
                            </div>
                            {displayData.email ? (
                                <div className="flex items-center gap-3 text-sm">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    <span>{displayData.email}</span>
                                </div>
                            ) : null}
                            {displayData.status === "invited" && displayData.inviteCode ? (
                                <div className="flex items-center gap-3 text-sm">
                                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                                    <span>
                                        Invite code <span className="font-mono font-semibold tracking-wider">{displayData.inviteCode}</span>
                                    </span>
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>

                    {/* Emergency Contact */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base font-semibold">Emergency Contact</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {displayData.emergencyContact && (displayData.emergencyContact.name || displayData.emergencyContact.phone) ? (
                                <div className="space-y-1">
                                    <p className="font-medium text-sm">{displayData.emergencyContact.name}</p>
                                    <p className="text-sm text-muted-foreground">{displayData.emergencyContact.phone}</p>
                                    {displayData.emergencyContact.relation && (
                                        <p className="text-xs text-muted-foreground mt-1 capitalize">Relation: {displayData.emergencyContact.relation}</p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No emergency contact provided.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Roles & Availability */}
                <div className="md:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Roles</CardTitle>
                            <CardDescription>What this worker can be scheduled for in your business.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {roles.length === 0 ? (
                                <div className="text-center py-6 text-sm text-muted-foreground border rounded-md">
                                    No roles set yet.
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {roles.map((role) => (
                                        <Badge key={role} variant="secondary" className="capitalize">{role}</Badge>
                                    ))}
                                </div>
                            )}
                            {/* Timesheet exports report hours, not pay: the payroll system applies rates. */}
                            <p className="text-sm text-muted-foreground">
                                Hourly rate: {displayData.hourlyRate ? `$${(displayData.hourlyRate / 100).toFixed(2)}/hr` : "not set"}. For your reference only; timesheets report hours.
                            </p>
                        </CardContent>
                    </Card>

                    {/* Availability Component */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Availability</CardTitle>
                            <CardDescription>View when this worker is unavailable for shifts (next 30 days).</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {displayData.userId ? (
                                <AvailabilityList workerId={displayData.userId} />
                            ) : (
                                <div className="text-center py-6 text-sm text-muted-foreground border rounded-md bg-muted/20">
                                    Availability shows once the worker has signed in to the app.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
