"use client";

import {
    ColumnDef,
    useReactTable,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    SortingState,
    FilterFn,
} from "@tanstack/react-table";
import { useState } from "react";
import { Input } from "@repo/ui/components/ui/input";
import { Button } from "@repo/ui/components/ui/button";
import { Search, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import { TimesheetRow } from "./timesheet-row";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";

import { TimesheetViewModel, getWorkerStatus } from "@/lib/timesheet-utils";

// Removed local TimesheetData in favor of shared TimesheetViewModel

// Custom filter for "Issues" (Late, Missing, etc)
const issueFilter: FilterFn<TimesheetViewModel> = (row, columnId, value) => {
    const worker = row.original;
    if (!value) return true; // Show all if filter is off

    const status = getWorkerStatus(worker);

    // Filter matches if any variant is not default
    return status.clockInVariant !== 'default' ||
        status.clockOutVariant !== 'default' ||
        status.breakVariant !== 'default';
};

interface TimesheetTableProps {
    data: TimesheetViewModel[];
    onUpdateWorker: (id: string, field: string, value: any) => void;
    onSaveWorker: (id: string, field: string, value: any) => void;
    isApproved: boolean;
    isCancelled: boolean;
    // getWorkerStatus is now internal/shared, removed from props
}

export function TimesheetTable({
    data,
    onUpdateWorker,
    onSaveWorker,
    isApproved,
    isCancelled,
}: TimesheetTableProps) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState("");
    const [showIssuesOnly, setShowIssuesOnly] = useState(false);

    // Columns are needed for sorting, even if we render custom rows
    const columns: ColumnDef<TimesheetViewModel>[] = [
        { accessorKey: "name", header: "Name" },
        { accessorKey: "clockIn", header: "Clock In" },
        { accessorKey: "clockOut", header: "Clock Out" },
        // Custom column for Status filtering
        {
            id: "status",
            accessorFn: (row) => row, // Access whole row for complex logic
            filterFn: issueFilter
        }
    ];

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        state: {
            sorting,
            globalFilter,
            columnFilters: showIssuesOnly ? [{ id: "status", value: true }] : [],
        },
    });

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search workers..."
                        value={globalFilter ?? ""}
                        onChange={(event) => setGlobalFilter(event.target.value)}
                        className="pl-9 bg-white"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 gap-1">
                                <SlidersHorizontal className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Filter</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Show only</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuCheckboxItem
                                checked={showIssuesOnly}
                                onCheckedChange={setShowIssuesOnly}
                            >
                                Needs Attention (Late/Missing)
                            </DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 gap-1"
                        onClick={() => setSorting([
                            sorting[0]?.id === "name" && sorting[0]?.desc === false
                                ? { id: "name", desc: true }
                                : { id: "name", desc: false }
                        ])}
                    >
                        <ArrowUpDown className="h-3.5 w-3.5" />
                        Sort by Name
                    </Button>
                </div>
            </div>

            {/* Content Card */}
            <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
                {/* Desktop Header - Preserved from DetailView but static since sorting is via Toolbar now (or could make clickable) */}
                <div className="hidden border-b border-border bg-muted/30 px-4 py-3 text-xs font-medium text-muted-foreground md:flex">
                    <div className="w-[250px] pl-2 cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => table.getColumn("name")?.toggleSorting()}
                    >
                        Name {table.getColumn("name")?.getIsSorted() === "asc" ? "↑" : table.getColumn("name")?.getIsSorted() === "desc" ? "↓" : ""}
                    </div>
                    <div className="w-[150px] text-center">Clock-in</div>
                    <div className="w-[150px] text-center">Clock-out</div>
                    <div className="w-[150px] text-center">Total unpaid break</div>
                    <div className="w-[120px] text-center">Rating</div>
                    <div className="w-[100px] text-center">Write Up</div>
                </div>

                {/* Rows powered by TanStack Table */}
                <div className="flex flex-col px-4 bg-white">
                    {table.getRowModel().rows?.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground">
                            {globalFilter || showIssuesOnly ? "No workers match your filters." : "No workers assigned to this shift."}
                        </div>
                    ) : (
                        table.getRowModel().rows.map((row) => {
                            const worker = row.original;
                            const status = getWorkerStatus(worker);
                            return (
                                <TimesheetRow
                                    key={worker.id}
                                    workerName={worker.name}
                                    workerAvatar={worker.avatar}
                                    jobTitle={worker.jobTitle}
                                    shiftDuration={worker.shiftDuration}
                                    clockIn={worker.clockIn}
                                    clockOut={worker.clockOut}
                                    breakDuration={worker.breakDuration}
                                    rating={worker.rating}
                                    clockInVariant={status.clockInVariant}
                                    clockOutVariant={status.clockOutVariant}
                                    breakVariant={status.breakVariant}
                                    disabled={isApproved || isCancelled}
                                    onClockInChange={(val) => onUpdateWorker(worker.id, "clockIn", val)}
                                    onClockOutChange={(val) => onUpdateWorker(worker.id, "clockOut", val)}
                                    onBreakChange={(val) => onUpdateWorker(worker.id, "breakDuration", val)}
                                    // Pass save handler for onBlur events
                                    onSave={(field, val) => onSaveWorker(worker.id, field, val)}
                                    onRatingChange={(r) => onUpdateWorker(worker.id, "rating", r)}
                                    onWriteUp={() => { }}
                                    onAddToRoster={() => { }}
                                    onReturn={() => { }}
                                    onBlock={() => { }}
                                />
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
