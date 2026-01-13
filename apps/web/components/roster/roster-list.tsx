"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { MoreVertical, Mail, Upload, Trash2, Send } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { AddWorkerDialog } from "./add-worker-dialog";
import { WorkerDetailsSheet, WorkerDetails } from "./worker-details-sheet";
import { useState } from "react";
import { resendInvite, deleteMemberAction } from "../../actions/invites";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from "@repo/ui/components/ui/dropdown-menu";

interface RosterListProps {
    workers: WorkerDetails[];
}

export function RosterList({ workers }: RosterListProps) {
    const [selectedWorker, setSelectedWorker] = useState<WorkerDetails | null>(null);
    const router = useRouter();

    const handleResend = async (e: React.MouseEvent, memberId: string) => {
        e.stopPropagation();
        toast.promise(resendInvite(memberId), {
            loading: "Resending invite...",
            success: "Invite sent successfully!",
            error: "Failed to resend invite"
        });
    };

    const handleDelete = async (e: React.MouseEvent, memberId: string) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to remove this worker from your roster?")) {
            toast.promise(deleteMemberAction(memberId), {
                loading: "Removing worker...",
                success: () => {
                    router.refresh();
                    return "Worker removed successfully";
                },
                error: "Failed to remove worker"
            });
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Staff List</CardTitle>
                    <CardDescription>
                        {workers.length} {workers.length === 1 ? 'worker' : 'workers'} in roster.
                    </CardDescription>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/rosters/import">
                            <Upload className="mr-2 h-4 w-4" />
                            Import CSV
                        </Link>
                    </Button>
                    <AddWorkerDialog />
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {workers.map((worker) => (
                        <div
                            key={worker.id}
                            className="grid grid-cols-[1fr_auto_auto] items-center gap-4 p-4 border rounded-xl hover:shadow-md transition-all cursor-pointer group bg-white"
                            onClick={() => setSelectedWorker(worker)}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <Avatar className="h-10 w-10 shrink-0">
                                    <AvatarImage src={worker.image || ""} />
                                    <AvatarFallback className="text-xs">{worker.name.charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 truncate">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-medium text-sm text-slate-900 leading-none truncate">{worker.name}</p>
                                        {worker.jobTitle && (
                                            <Badge variant="secondary" className="text-[10px] px-2 py-0.5 h-auto font-normal shrink-0 rounded-full">
                                                {worker.jobTitle}
                                            </Badge>
                                        )}
                                        {worker.status === "invited" && (
                                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 h-auto text-amber-600 bg-amber-50 shrink-0 rounded-full">
                                                Invited
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 truncate">
                                        {worker.email}
                                    </p>
                                </div>
                            </div>

                            <div className="text-right hidden sm:block whitespace-nowrap px-4">
                                <p className="text-[10px] text-muted-foreground">
                                    {worker.status === 'invited'
                                        ? `Invited ${format(new Date(worker.joinedAt), "MMM d")}`
                                        : `Joined ${format(new Date(worker.joinedAt), "MMM d, yyyy")}`
                                    }
                                </p>
                            </div>

                            <div className="shrink-0">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <MoreVertical className="h-4 w-4" />
                                            <span className="sr-only">Actions</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                            onClick={(e) => handleResend(e, worker.id)}
                                        >
                                            <Send className="mr-2 h-4 w-4" />
                                            Resend Invite
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                                            onClick={(e) => handleDelete(e, worker.id)}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Remove from Roster
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    ))}
                    {workers.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground border rounded-xl border-dashed">
                            <p>No workers found.</p>
                            <p className="text-sm">Add a worker or import a CSV to get started.</p>
                        </div>
                    )}
                </div>
            </CardContent>
            <WorkerDetailsSheet
                worker={selectedWorker}
                isOpen={!!selectedWorker}
                onClose={() => setSelectedWorker(null)}
            />
        </Card>
    );
}
