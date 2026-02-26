"use client"

import * as React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@repo/ui/components/ui/badge"
import { Checkbox } from "@repo/ui/components/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar"
import { format } from "date-fns"
import { MoreHorizontal, ArrowUpDown } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { removeWorker, inviteWorker } from "../../actions/workers"

import { Button } from "@repo/ui/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu"

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetFooter,
    SheetClose,
} from "@repo/ui/components/ui/sheet"

export type WorkerDetails = {
    id: string
    role: string | null
    joinedAt: Date
    jobTitle: string | null
    name: string
    email: string
    phone: string | null
    image: string | null
    status: "active" | "invited" | "uninvited"
    hourlyRate?: number | null
    emergencyContact?: { name: string; phone: string; relation?: string } | null
}

function WorkerCellViewer({ worker }: { worker: WorkerDetails }) {
    const isPureInvitation = worker.name === worker.email && worker.status === "invited";

    return (
        <Sheet>
            <SheetTrigger asChild>
                <button className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left text-foreground">
                    <Avatar className="h-8 w-8 border">
                        <AvatarImage src={worker.image || undefined} alt={worker.name} />
                        <AvatarFallback>{worker.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="font-medium text-sm hover:underline">{worker.name}</span>
                    </div>
                </button>
            </SheetTrigger>
            <SheetContent className="overflow-y-auto">
                <SheetHeader className="text-left gap-2 mb-6 mt-4">
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16 border-2 border-primary/10">
                            <AvatarImage src={worker.image || undefined} alt={worker.name} />
                            <AvatarFallback className="text-xl">{worker.name.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                            <SheetTitle className="text-xl">{worker.name}</SheetTitle>
                            <SheetDescription className="text-base mt-1">
                                {worker.jobTitle || worker.role || "Member"}
                            </SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                <div className="flex flex-col gap-6 py-4 px-1">
                    <div className="grid gap-4">
                        <div className="grid gap-1">
                            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Contact</span>
                            <span className="text-sm">{worker.email}</span>
                            {worker.phone && <span className="text-sm">{worker.phone}</span>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-1">
                                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Hourly Rate</span>
                                <span className="text-sm font-medium">
                                    {worker.hourlyRate ? `$${(worker.hourlyRate / 100).toFixed(2)}/hr` : "Not set"}
                                </span>
                            </div>
                            <div className="grid gap-1">
                                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Status</span>
                                <span className="text-sm font-medium capitalize">{worker.status}</span>
                            </div>
                        </div>

                        <div className="grid gap-1">
                            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Date Added</span>
                            <span className="text-sm">{format(new Date(worker.joinedAt), "PPpp")}</span>
                        </div>
                    </div>
                </div>

                <SheetFooter className="mt-8 flex flex-col sm:flex-col gap-2">
                    {isPureInvitation ? (
                        <Button disabled className="w-full">No Full Profile Yet</Button>
                    ) : (
                        <Button asChild className="w-full">
                            <Link href={`/workers/${worker.id}`}>View Full Profile</Link>
                        </Button>
                    )}
                    <SheetClose asChild>
                        <Button variant="outline" className="w-full">Close</Button>
                    </SheetClose>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}

export const columns: ColumnDef<WorkerDetails>[] = [
    {
        id: "select",
        header: ({ table }) => (
            <div className="flex items-center justify-center">
                <Checkbox
                    checked={
                        table.getIsAllPageRowsSelected() ||
                        (table.getIsSomePageRowsSelected() && "indeterminate")
                    }
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            </div>
        ),
        cell: ({ row }) => (
            <div className="flex items-center justify-center">
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            </div>
        ),
        enableSorting: false,
        enableHiding: false,
    },
    {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
            return <WorkerCellViewer worker={row.original} />
        },
    },
    {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => {
            return <span className="text-sm">{row.original.email}</span>
        }
    },
    {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) => {
            return <span className="text-sm text-muted-foreground">{row.original.phone || "—"}</span>
        }
    },
    {
        accessorKey: "jobTitle",
        header: "Role",
        cell: ({ row }) => {
            const worker = row.original;
            return (
                <span className="text-sm font-medium capitalize">{worker.jobTitle || worker.role || "Member"}</span>
            )
        }
    },
    {
        accessorKey: "hourlyRate",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="-ml-4"
                >
                    Rate
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => {
            const worker = row.original;
            const rate = worker.hourlyRate ? `$${(worker.hourlyRate / 100).toFixed(2)}/hr` : "—";
            return (
                <span className="text-sm text-muted-foreground">{rate}</span>
            )
        }
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.getValue("status") as string;

            if (status === "active") {
                return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Active</Badge>
            }
            if (status === "invited") {
                return <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-200">Invited</Badge>
            }
            if (status === "uninvited") {
                return <Badge variant="outline" className="text-slate-500">Uninvited</Badge>
            }
            return <Badge variant="outline">{status}</Badge>
        }
    },
    {
        accessorKey: "joinedAt",
        header: "Date Added",
        cell: ({ row }) => {
            const date = row.getValue("joinedAt") as Date;
            return <span className="text-sm text-muted-foreground">{format(new Date(date), "MMM d, yyyy")}</span>
        }
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const worker = row.original;
            const isPureInvitation = worker.name === worker.email && worker.status === "invited";

            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild disabled={isPureInvitation}>
                            {isPureInvitation ? (
                                <span>No Profile Yet</span>
                            ) : (
                                <Link href={`/workers/${worker.id}`}>View details</Link>
                            )}
                        </DropdownMenuItem>
                        {worker.status !== "active" && (
                            <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => {
                                    toast.promise(inviteWorker({
                                        name: worker.name,
                                        email: worker.email,
                                        phoneNumber: worker.phone || undefined,
                                        role: (worker.role as "admin" | "member") || "member",
                                        jobTitle: worker.jobTitle || undefined,
                                        hourlyRate: worker.hourlyRate || undefined,
                                        invites: { email: true, sms: !!worker.phone }
                                    }), {
                                        loading: "Resending invite...",
                                        success: (result) => {
                                            if (result.error) throw new Error(result.error);
                                            return "Invite resent successfully";
                                        },
                                        error: (err) => err.message || "Failed to resend invite"
                                    });
                                }}
                            >
                                Resend Invite
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                            className="text-red-600 font-medium cursor-pointer"
                            onClick={() => {
                                if (!confirm(`Are you sure you want to remove ${worker.name}?`)) return;
                                toast.promise(removeWorker(worker.email), {
                                    loading: "Removing worker...",
                                    success: (result) => {
                                        if (result.error) throw new Error(result.error);
                                        return "Worker removed successfully";
                                    },
                                    error: (err) => err.message || "Failed to remove worker"
                                });
                            }}
                        >
                            Remove Worker
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        },
    },
]
