// apps/web/components/settings/team-list.tsx

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Plus, MoreVertical, Mail } from "lucide-react";
import Link from "next/link";
import { AddMemberDialog } from "@/components/settings/team/add-member-dialog";
import { Upload } from "lucide-react";
import { format } from "date-fns";

interface TeamListProps {
    members: Array<{
        id: string;
        role: string;
        joinedAt: Date;
        name: string;
        email: string;
        image?: string | null;
        hourlyRate?: number | null;
        jobTitle?: string | null;
    }>;
}

export function TeamList({ members }: TeamListProps) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Team Members</CardTitle>
                    <CardDescription>
                        Manage who has access to this organization.
                    </CardDescription>
                </div>
                <div className="flex gap-2">
                    {/* Admin Invite Dialog could go here in future */}
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {members.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={member.image || ""} alt={member.name} />
                                    <AvatarFallback>{member.name.charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium text-sm">{member.name}</p>
                                        <Badge variant={member.role === "owner" ? "default" : "secondary"} className="text-[10px] px-1 py-0 h-4 capitalize">
                                            {member.role}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Mail className="h-3 w-3" />
                                        {member.email}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-muted-foreground">
                                    Joined {format(new Date(member.joinedAt), "MMM d, yyyy")}
                                </p>
                            </div>
                        </div>
                    ))}
                    {members.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                            No team members found.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
