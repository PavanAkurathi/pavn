"use client"

import * as React from "react"
import { ColumnDef, Row } from "@tanstack/react-table"
import { InitialsAvatar } from "@repo/ui/components/app/initials-avatar"
import { Pill } from "@repo/ui/components/app/pill"
import { roleHue } from "@repo/ui/lib/role-hue"
import { Checkbox } from "@repo/ui/components/ui/checkbox"
import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar"
import { format } from "date-fns"
import { MoreHorizontal, ArrowUpDown } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { removeWorker, bulkInviteWorkers } from "@/actions/workers"
import { useConfirm } from "@/components/ui/use-confirm"

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
    joinedAt: Date
    jobTitle: string | null
    roles: string[]
    name: string
    email: string | null
    phone: string | null
    /** added = on the list only; invited = texted the app; active = has signed in. */
    status: "added" | "invited" | "active" | "inactive"
    hasAccount: boolean
    /** Reference only; nothing computes pay from it. */
    hourlyRate?: number | null
}

const STATUS_LABEL: Record<WorkerDetails["status"], string> = {
    added: "Not invited",
    invited: "Invite sent",
    active: "On the app",
    inactive: "Inactive",
}

function WorkerCellViewer({ worker }: { worker: WorkerDetails }) {
    return (
        <Sheet>
            <SheetTrigger asChild>
                <button className="flex items-center gap-3 text-left text-foreground transition-opacity hover:opacity-80">
                    <InitialsAvatar name={worker.name} hue={roleHue(worker.jobTitle ?? worker.roles[0])} size="md" />
                    <div className="flex min-w-0 flex-col">
                        <span className="text-[13px] font-bold hover:underline">{worker.name}</span>
                        <span className="truncate text-[11.5px] text-muted-foreground">{worker.phone || worker.email}</span>
                    </div>
                </button>
            </SheetTrigger>
            <SheetContent className="overflow-y-auto">
                <SheetHeader className="text-left gap-2 mb-6 mt-4">
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16 border-2 border-primary/10">
                            <AvatarFallback className="text-xl">{worker.name.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                            <SheetTitle className="text-xl">{worker.name}</SheetTitle>
                            <SheetDescription className="text-base mt-1">
                                {worker.jobTitle || worker.roles[0] || "No role set"}
                            </SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                <div className="flex flex-col gap-6 py-4 px-1">
                    <div className="grid gap-4">
                        <div className="grid gap-1">
                            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Contact</span>
                            {worker.phone ? <span className="text-sm">{worker.phone}</span> : <span className="text-sm text-muted-foreground">No phone number</span>}
                            {worker.email && <span className="text-sm">{worker.email}</span>}
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
                                <span className="text-sm font-medium">{STATUS_LABEL[worker.status]}</span>
                            </div>
                        </div>

                        <div className="grid gap-1">
                            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Date Added</span>
                            <span className="text-sm">{format(new Date(worker.joinedAt), "PPpp")}</span>
                        </div>
                    </div>
                </div>

                <SheetFooter className="mt-8 flex flex-col sm:flex-col gap-2">
                    <Button asChild className="w-full">
                        <Link href={`/workers/${worker.id}`}>View Full Profile</Link>
                    </Button>
                    <SheetClose asChild>
                        <Button variant="outline" className="w-full">Close</Button>
                    </SheetClose>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}

/**
 * Row actions live in their own component so they can use hooks. A column
 * `cell` callback is not a component boundary React will honour, and the
 * confirm dialog needs state.
 */
function WorkerRowActions({ row }: { row: Row<WorkerDetails> }) {
    const { confirm, confirmDialog } = useConfirm();
    const worker = row.original;

    return (
        <>
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
                <DropdownMenuItem asChild>
                    <Link href={`/workers/${worker.id}`}>View details</Link>
                </DropdownMenuItem>
                {(worker.status === "added" || worker.status === "invited") && (
                    <DropdownMenuItem
                        className="cursor-pointer"
                        disabled={!worker.phone}
                        onClick={() => {
                            toast.promise(bulkInviteWorkers([worker.id]), {
                                loading: "Sending invite...",
                                success: (result) => {
                                    if (result.error) throw new Error(result.error);
                                    const skipped = result.skipped?.[0];
                                    if (skipped) throw new Error(skipped.reason);
                                    return "Invite sent by text";
                                },
                                error: (err) => err.message || "Failed to send invite"
                            });
                        }}
                    >
                        {worker.status === "added" ? "Send invite" : "Resend invite"}
                        {!worker.phone && " (add a phone number first)"}
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem
                    className="text-red-600 font-medium cursor-pointer"
                    onClick={async () => {
                        const ok = await confirm({
                            title: `Remove ${worker.name}?`,
                            description: "Their past shifts and hours stay on record. They lose access to the app right away.",
                            confirmLabel: "Remove worker",
                            destructive: true,
                        });
                        if (!ok) return;
                        toast.promise(removeWorker(worker.id), {
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
        {confirmDialog}
        </>
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
        accessorKey: "jobTitle",
        header: "Role",
        cell: ({ row }) => {
            const worker = row.original;
            const role = worker.jobTitle || worker.roles[0] || "No role set";
            return (
                <Pill tone="role" hue={roleHue(role)}>
                    {role}
                </Pill>
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

            if (status === "active") return <Pill>On the app</Pill>
            if (status === "invited") return <Pill tone="warning">Invite sent</Pill>
            if (status === "added") return <Pill>Not invited</Pill>
            if (status === "inactive") return <Pill>Inactive</Pill>
            return <Pill>{status}</Pill>
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
        cell: ({ row }) => <WorkerRowActions row={row} />,
    },
]
