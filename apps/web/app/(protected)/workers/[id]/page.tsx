import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@repo/database";
import { member, user, rosterEntry, workerRole } from "@repo/database/schema";
import { eq, and } from "@repo/database";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { ArrowLeft, Plus, Phone, Mail, HelpCircle } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/components/ui/table";
import { AvailabilityList } from "@/components/roster/availability-list";

interface PageProps {
    params: {
        id: string;
    };
}

export default async function WorkerProfilePage({ params }: PageProps) {
    const { id } = await params;

    // 1. Authenticate and get active organization
    const sessionResponse = await auth.api.getSession({
        headers: await headers()
    });

    if (!sessionResponse) {
        redirect("/auth/sign-in");
    }

    const { user: currentUser, session } = sessionResponse;
    const activeOrgId = (session as any).activeOrganizationId as string;

    if (!activeOrgId) {
        redirect("/auth/sign-in");
    }

    // 2. Resolve the ID. First try member, then roster_entry
    const memberRecord = await db.query.member.findFirst({
        where: and(eq(member.id, id), eq(member.organizationId, activeOrgId)),
        with: {
            user: true
        }
    });

    let displayData = {
        name: "",
        email: "",
        phone: null as string | null,
        image: null as string | null,
        status: "Unknown",
        emergencyContact: null as { name: string; phone: string; relation?: string } | null,
        joinedAt: new Date(),
        userId: null as string | null,
    };

    if (memberRecord) {
        displayData = {
            name: memberRecord.user.name,
            email: memberRecord.user.email,
            phone: memberRecord.user.phoneNumber,
            image: memberRecord.user.image,
            status: memberRecord.user.emailVerified ? "Active" : "Invited",
            emergencyContact: memberRecord.user.emergencyContact,
            joinedAt: memberRecord.createdAt,
            userId: memberRecord.user.id
        };
    } else {
        // Fallback to roster entry
        const rosterRecord = await db.query.rosterEntry.findFirst({
            where: and(eq(rosterEntry.id, id), eq(rosterEntry.organizationId, activeOrgId))
        });

        if (!rosterRecord) {
            return (
                <div className="flex flex-col items-center justify-center py-20">
                    <HelpCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h2 className="text-xl font-semibold">Worker not found</h2>
                    <p className="text-muted-foreground mb-6">This worker does not exist or has been removed from your organization.</p>
                    <Link href="/rosters">
                        <Button variant="outline">Back to Roster</Button>
                    </Link>
                </div>
            );
        }

        displayData = {
            name: rosterRecord.name,
            email: rosterRecord.email,
            phone: rosterRecord.phoneNumber,
            image: null,
            status: rosterRecord.status === "invited" ? "Invited" : "Uninvited",
            emergencyContact: null,
            joinedAt: rosterRecord.createdAt || new Date(),
            userId: null
        };
    }

    // 3. Fetch Organization Roles if it's a full member
    let roles: any[] = [];
    if (displayData.userId) {
        roles = await db.query.workerRole.findMany({
            where: and(
                eq(workerRole.workerId, displayData.userId),
                eq(workerRole.organizationId, activeOrgId)
            ),
            orderBy: (roles, { desc }) => [desc(roles.createdAt)]
        });
    }

    return (
        <div className="max-w-4xl space-y-8">
            {/* Header / Breadcrumb */}
            <div className="flex items-center gap-4">
                <Link href="/rosters">
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
                                variant={displayData.status === "Active" ? "default" : "outline"}
                                className={displayData.status === "Active" ? "bg-green-500 mt-2" : "mt-2"}
                            >
                                {displayData.status}
                            </Badge>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-3 text-sm">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span>{displayData.email}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span>{displayData.phone || "No phone number"}</span>
                            </div>
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
                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                            <div>
                                <CardTitle className="text-lg">Roles & Rates</CardTitle>
                                <CardDescription>Manage the specific roles this worker holds in your organization.</CardDescription>
                            </div>
                            <Button size="sm" disabled={!displayData.userId}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Role
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {!displayData.userId ? (
                                <div className="text-center py-6 text-sm text-muted-foreground border rounded-md bg-muted/20">
                                    Worker must accept their invite before you can assign specific roles.
                                </div>
                            ) : roles.length === 0 ? (
                                <div className="text-center py-6 text-sm text-muted-foreground border rounded-md">
                                    No roles assigned. Click "Add Role" to get started.
                                </div>
                            ) : (
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Role Title</TableHead>
                                                <TableHead>Hourly Rate</TableHead>
                                                <TableHead className="text-right">Added On</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {roles.map((r) => (
                                                <TableRow key={r.id}>
                                                    <TableCell className="font-medium capitalize">{r.role}</TableCell>
                                                    <TableCell>{r.hourlyRate ? `$${(r.hourlyRate / 100).toFixed(2)}/hr` : "Standard"}</TableCell>
                                                    <TableCell className="text-right text-muted-foreground text-sm">
                                                        {format(new Date(r.createdAt), "MMM d, yyyy")}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
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
                                    Worker must accept their invite before availability can be monitored.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
