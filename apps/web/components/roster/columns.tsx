"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@repo/ui/components/ui/badge"
import { Checkbox } from "@repo/ui/components/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar"
import { format } from "date-fns"
import { MoreHorizontal } from "lucide-react"
import Link from "next/link"

import { Button } from "@repo/ui/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu"

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

export const columns: ColumnDef<WorkerDetails>[] = [
    {
        id: "select",
        header: ({ table }) => (
            <Checkbox
                checked={
                    table.getIsAllPageRowsSelected() ||
                    (table.getIsSomePageRowsSelected() && "indeterminate")
                }
                onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                aria-label="Select all"
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="Select row"
            />
        ),
        enableSorting: false,
        enableHiding: false,
    },
    {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
            const worker = row.original;
            return (
                <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={worker.image || undefined} alt={worker.name} />
                        <AvatarFallback>{worker.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <Link href={`/workers/${worker.id}`} className="flex flex-col hover:underline">
                        <span className="font-medium text-sm">{worker.name}</span>
                    </Link>
                </div>
            )
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
        header: "Role & Rate",
        cell: ({ row }) => {
            const worker = row.original;
            const rate = worker.hourlyRate ? `$${(worker.hourlyRate / 100).toFixed(2)}/hr` : "No rate";
            return (
                <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium capitalize">{worker.jobTitle || worker.role || "Member"}</span>
                    <span className="text-xs text-muted-foreground">{rate}</span>
                </div>
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
            const worker = row.original

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
                        <DropdownMenuItem>View details</DropdownMenuItem>
                        {worker.status !== "active" && (
                            <DropdownMenuItem>Resend Invite</DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-red-600 font-medium">Remove Worker</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        },
    },
]
