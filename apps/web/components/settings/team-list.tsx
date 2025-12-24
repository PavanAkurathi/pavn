"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Plus, MoreVertical, Mail } from "lucide-react";
import { format } from "date-fns";

interface TeamListProps {
    members: Array<{
        id: string;
        role: string;
        joinedAt: Date;
        name: string;
        email: string;
        image?: string | null;
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
                <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Invite Member
                </Button>
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
                                    <p className="font-medium text-sm">{member.name}</p>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Mail className="h-3 w-3" />
                                        {member.email}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right hidden sm:block">
                                    <Badge
                                        variant="outline"
                                        className={`capitalize mb-1 ${(member.role === "admin" || member.role === "owner")
                                            ? "border-[#D95829]/20 bg-[#D95829]/10 text-[#D95829] hover:bg-[#D95829]/20 hover:text-[#D95829]"
                                            : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-50 hover:text-slate-700"}`}
                                    >
                                        {member.role === "owner" ? "admin" : member.role}
                                    </Badge>
                                    <p className="text-[10px] text-muted-foreground">
                                        Joined {format(new Date(member.joinedAt), "MMM d, yyyy")}
                                    </p>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                    <span className="sr-only">Menu</span>
                                </Button>
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
