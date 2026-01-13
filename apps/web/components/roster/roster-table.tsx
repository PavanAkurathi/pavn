"use client";

import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
    getPaginationRowModel,
    getSortedRowModel,
    SortingState,
    getFilteredRowModel,
} from "@tanstack/react-table";
import { useState } from "react";
import { WorkerDetails } from "./worker-details-sheet";
import { Input } from "@repo/ui/components/ui/input";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { Badge } from "@repo/ui/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@repo/ui/components/ui/dropdown-menu";
import { MoreVertical, Send, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { AddWorkerDialog } from "./add-worker-dialog";
import { toast } from "sonner";
import { resendInvite, deleteMemberAction } from "../../actions/invites";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { WorkerDetailsSheet } from "./worker-details-sheet";

interface RosterTableProps {
    data: WorkerDetails[];
}

export function RosterTable({ data }: RosterTableProps) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState("");
    const [selectedWorker, setSelectedWorker] = useState<WorkerDetails | null>(null);
    const router = useRouter();

    // Since we are rendering Custom Cards, we don't strictly *need* columns for display,
    // but they are required for the table engine to know what data exists for sorting/filtering.
    // We define them but mostly just use the row.original data for the card.
    const columns: ColumnDef<WorkerDetails>[] = [
        { accessorKey: "name", header: "Name" },
        { accessorKey: "email", header: "Email" },
        { accessorKey: "role", header: "Role" },
        { accessorKey: "status", header: "Status" },
    ];

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onGlobalFilterChange: setGlobalFilter,
        state: {
            sorting,
            globalFilter,
        },
    });

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
        <div className="space-y-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Staff List</CardTitle>
                        <CardDescription>
                            {data.length} {data.length === 1 ? 'worker' : 'workers'} in roster.
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Input
                            placeholder="Search workers..."
                            value={globalFilter ?? ""}
                            onChange={(event) => setGlobalFilter(event.target.value)}
                            className="max-w-xs h-9"
                        />
                        <Button variant="outline" size="sm" asChild className="h-9">
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
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => {
                                const worker = row.original;
                                return (
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
                                );
                            })
                        ) : (
                            <div className="text-center py-12 text-muted-foreground border rounded-xl border-dashed">
                                <p>No workers found.</p>
                                <p className="text-sm">Try using different search terms.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <WorkerDetailsSheet
                worker={selectedWorker}
                isOpen={!!selectedWorker}
                onClose={() => setSelectedWorker(null)}
            />
        </div>
    );
}
