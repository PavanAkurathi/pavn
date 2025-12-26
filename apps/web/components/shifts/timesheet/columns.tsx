'use client';

import { ColumnDef } from "@tanstack/react-table";
import { Info, Phone, Map, MoreVertical } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "@repo/ui/components/ui/tooltip";

import { TimesheetWorker } from "@/lib/types";
import { ProfileCell, ClockCell, BreakCell, RosterCell } from "./cells";

export const columns: ColumnDef<TimesheetWorker>[] = [
    {
        accessorKey: "name",
        header: "Name",
        size: 280,
        cell: ({ row }) => {
            const props: any = {
                id: row.original.id,
                name: row.original.name,
                initials: row.original.avatarInitials,
                role: row.original.role,
                rate: row.original.hourlyRate,
            };

            if (row.original.avatarUrl) {
                props.url = row.original.avatarUrl;
            }

            return <ProfileCell {...props} />;
        },
    },
    {
        accessorKey: "clockIn",
        header: "Clock-in",
        size: 120,
        cell: ({ row }) => (
            <ClockCell
                value={row.getValue("clockIn")}
                label="Start Time"
                onSave={(val) => console.log("Update In:", row.original.id, val)}
            />
        ),
    },
    {
        accessorKey: "clockOut",
        header: "Clock-out",
        size: 120,
        cell: ({ row }) => (
            <ClockCell
                value={row.getValue("clockOut")}
                label="End Time"
                onSave={(val) => console.log("Update Out:", row.original.id, val)}
            />
        ),
    },
    {
        accessorKey: "breakMinutes",
        header: () => (
            <div className="flex items-center gap-1">
                Break
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger>
                            <Info className="h-3 w-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>Unpaid break deducted from total hours</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        ),
        size: 120,
        cell: ({ row }) => (
            <BreakCell
                value={row.getValue("breakMinutes")}
                onChange={(val) => console.log("Update Break:", row.original.id, val)}
            />
        ),
    },
    {
        accessorKey: "status",
        header: "Roster status",
        cell: ({ row }) => (
            <div className="min-w-[180px]">
                <RosterCell status={row.getValue("status")} name={row.original.name} />
            </div>
        ),
    },
    {
        id: "actions",
        cell: () => (
            <div className="flex items-center justify-end gap-1">
                <ActionIcon icon={Phone} />
                <ActionIcon icon={Map} />
                <ActionIcon icon={MoreVertical} />
            </div>
        ),
    },
];

function ActionIcon({ icon: Icon }: { icon: any }) {
    return (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <Icon className="h-4 w-4" />
        </Button>
    );
}
