// apps/web/components/settings/team-list.tsx

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Plus, MoreVertical, Mail } from "lucide-react";
import Link from "next/link";
import { AddMemberDialog } from "./team/add-member-dialog";
import { format } from "date-fns";

interface TeamListProps {
    members: Array<{
        id: string;
        entryType: "member" | "invitation";
        role: string;
        joinedAt: Date;
        name: string;
        email: string;
        image?: string | null;
        jobTitle?: string | null;
        status?: "active" | "invited";
        user?: { id: string };
    }>;
    currentUserId: string;
}

export function TeamList({ members, currentUserId }: TeamListProps) {
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
                    <AddMemberDialog />
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {members.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-4 border rounded-xl hover:shadow-sm transition-all bg-white">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={member.image || ""} alt={member.name} />
                                    <AvatarFallback>{member.name.charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium text-sm">{member.name}</p>
                                        <Badge variant={member.role === "owner" ? "default" : "secondary"} className="text-[10px] px-2 py-0.5 h-auto capitalize rounded-full">
                                            {member.role}
                                        </Badge>
                                        {member.status === "invited" && (
                                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 h-auto text-amber-600 border-amber-200 bg-amber-50 rounded-full">
                                                Invited
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                        <Mail className="h-3 w-3" />
                                        {member.email}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right flex items-center gap-2">
                                <div className="text-right mr-2 hidden sm:block">
                                    <p className="text-[10px] text-muted-foreground">
                                        {member.status === 'invited'
                                            ? `Invited ${format(new Date(member.joinedAt), "MMM d")}`
                                            : `Joined ${format(new Date(member.joinedAt), "MMM d, yyyy")}`
                                        }
                                    </p>
                                </div>

                                <TeamActions
                                    entryId={member.id}
                                    entryType={member.entryType}
                                    memberRole={member.role}
                                    isSelf={member.user?.id === currentUserId}
                                    status={member.status}
                                />
                            </div>
                        </div>
                    ))}
                    {members.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground border rounded-xl border-dashed">
                            No team members found.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import {
    cancelTeamInvite,
    deleteMemberAction,
    resendTeamInvite,
} from "@/actions/invites";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

function TeamActions({
    entryId,
    entryType,
    memberRole,
    isSelf,
    status,
}: {
    entryId: string;
    entryType: "member" | "invitation";
    memberRole: string;
    isSelf: boolean;
    status?: string;
}) {
    const router = useRouter();

    const handleResend = async () => {
        toast.promise(resendTeamInvite(entryId), {
            loading: "Resending invite...",
            success: "Invite sent successfully!",
            error: "Failed to resend invite"
        });
    };

    const handleRemoveMember = async () => {
        if (!confirm("Are you sure you want to remove this member? They will lose access immediately.")) return;

        toast.promise(deleteMemberAction(entryId), {
            loading: "Removing member...",
            success: () => {
                router.refresh();
                return "Member removed";
            },
            error: "Failed to remove member"
        });
    };

    const handleCancelInvitation = async () => {
        if (!confirm("Cancel this invitation? The recipient will need a new invite link to join later.")) return;

        toast.promise(cancelTeamInvite(entryId), {
            loading: "Canceling invitation...",
            success: () => {
                router.refresh();
                return "Invitation canceled";
            },
            error: "Failed to cancel invitation",
        });
    };

    if (entryType === "member" && (memberRole === "owner" || isSelf)) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreVertical className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                {entryType === "invitation" && status === 'invited' && (
                    <>
                        <DropdownMenuItem onClick={handleResend}>
                            Resend Invite
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={handleCancelInvitation}
                            className="text-red-600 focus:text-red-600"
                        >
                            Cancel Invite
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                    </>
                )}
                {entryType === "member" ? (
                    <DropdownMenuItem onClick={handleRemoveMember} className="text-red-600 focus:text-red-600">
                    Remove Member
                    </DropdownMenuItem>
                ) : null}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
