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
import { useState, useTransition } from "react";
import { Input } from "@repo/ui/components/ui/input";
import { Button } from "@repo/ui/components/ui/button";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@repo/ui/components/ui/empty";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    InputGroupText,
} from "@repo/ui/components/ui/input-group";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/components/ui/toggle-group";
import { Search, TriangleAlert, ArrowDownAZ, ArrowUpAZ, Users } from "lucide-react";
import { TimesheetRow } from "./timesheet-row";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@repo/ui/components/ui/alert-dialog";

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
    onCommitWorker: (
        id: string,
        changes: Partial<Pick<TimesheetViewModel, "clockIn" | "clockOut" | "breakOneDuration" | "breakTwoDuration">>,
    ) => Promise<boolean>;
    onUpdateWorkerNotes: (id: string, value: string) => void;
    onRemoveWorker: (id: string) => void;
    isApproved: boolean;
    isCancelled: boolean;
}

interface PendingTimesheetConfirmation {
    workerId: string;
    workerName: string;
    changes: Partial<Pick<TimesheetViewModel, "clockIn" | "clockOut" | "breakOneDuration" | "breakTwoDuration">>;
    summaries: Array<{
        label: string;
        previous: string;
        next: string;
    }>;
}

export function TimesheetTable({
    data,
    onCommitWorker,
    onUpdateWorkerNotes,
    onRemoveWorker,
    isApproved,
    isCancelled,
}: TimesheetTableProps) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState("");
    const [showIssuesOnly, setShowIssuesOnly] = useState(false);
    const [pendingConfirmation, setPendingConfirmation] = useState<PendingTimesheetConfirmation | null>(null);
    const [isSaving, startSavingTransition] = useTransition();

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

    const confirmPendingChange = () => {
        if (!pendingConfirmation) {
            return;
        }

        startSavingTransition(async () => {
            const saved = await onCommitWorker(pendingConfirmation.workerId, pendingConfirmation.changes);
            if (saved) {
                setPendingConfirmation(null);
            }
        });
    };

    const sortMode =
        sorting[0]?.id === "name" && sorting[0]?.desc
            ? "za"
            : "az";

    return (
        <div className="space-y-3.5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="max-w-sm flex-1">
                    <InputGroup className="h-10 rounded-lg">
                        <InputGroupAddon align="inline-start">
                            <InputGroupText>
                                <Search />
                            </InputGroupText>
                        </InputGroupAddon>
                        <InputGroupInput
                        placeholder="Search workers..."
                        value={globalFilter ?? ""}
                        onChange={(event) => setGlobalFilter(event.target.value)}
                        className="h-10"
                    />
                    </InputGroup>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <ToggleGroup
                        type="single"
                        value={showIssuesOnly ? "issues" : "all"}
                        variant="outline"
                        size="sm"
                        onValueChange={(value) => {
                            if (!value) return;
                            setShowIssuesOnly(value === "issues");
                        }}
                        className="justify-start"
                    >
                        <ToggleGroupItem value="all">All records</ToggleGroupItem>
                        <ToggleGroupItem value="issues">
                            <TriangleAlert />
                            Needs review
                        </ToggleGroupItem>
                    </ToggleGroup>

                    <ToggleGroup
                        type="single"
                        value={sortMode}
                        variant="outline"
                        size="sm"
                        onValueChange={(value) => {
                            if (!value) return;
                            setSorting([{ id: "name", desc: value === "za" }]);
                        }}
                        className="justify-start"
                    >
                        <ToggleGroupItem value="az">
                            <ArrowUpAZ />
                            A to Z
                        </ToggleGroupItem>
                        <ToggleGroupItem value="za">
                            <ArrowDownAZ />
                            Z to A
                        </ToggleGroupItem>
                    </ToggleGroup>
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
                <div className="hidden border-b bg-muted/30 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground md:grid md:grid-cols-[minmax(220px,1.45fr)_148px_148px_116px_116px_minmax(160px,1fr)_132px] md:items-center md:gap-3.5">
                    <div
                        className="cursor-pointer pl-2 transition-colors hover:text-foreground"
                        onClick={() => table.getColumn("name")?.toggleSorting()}
                    >
                        Name {table.getColumn("name")?.getIsSorted() === "asc" ? "↑" : table.getColumn("name")?.getIsSorted() === "desc" ? "↓" : ""}
                    </div>
                    <div className="text-center">Clock-in</div>
                    <div className="text-center">Clock-out</div>
                    <div className="text-center">Break 1</div>
                    <div className="text-center">Break 2</div>
                    <div className="text-center">Notes</div>
                    <div className="text-right">Actions</div>
                </div>

                <div className="flex flex-col bg-white px-5">
                    {table.getRowModel().rows?.length === 0 ? (
                        <Empty className="border-0 py-12 md:py-14">
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    {globalFilter || showIssuesOnly ? <Search /> : <Users />}
                                </EmptyMedia>
                                <EmptyTitle>
                                    {globalFilter || showIssuesOnly ? "No workers match these filters" : "No workers assigned yet"}
                                </EmptyTitle>
                                <EmptyDescription>
                                    {globalFilter || showIssuesOnly
                                        ? "Try clearing the search or switching back to all records."
                                        : "Add workers to this shift to start collecting clock-ins, clock-outs, and breaks."}
                                </EmptyDescription>
                            </EmptyHeader>
                            <EmptyContent />
                        </Empty>
                    ) : (
                        table.getRowModel().rows.map((row) => {
                            const worker = row.original;
                            const status = getWorkerStatus(worker);
                            return (
                                <TimesheetRow
                                    key={worker.id}
                                    workerId={worker.id}
                                    workerName={worker.name}
                                    workerAvatar={worker.avatar}
                                    shiftDuration={worker.shiftDuration}
                                    clockIn={worker.clockIn}
                                    clockOut={worker.clockOut}
                                    breakDuration={worker.breakDuration}
                                    breakOneDuration={worker.breakOneDuration || "0 min"}
                                    breakTwoDuration={worker.breakTwoDuration || "0 min"}
                                    notes={worker.notes}
                                    clockInVariant={status.clockInVariant}
                                    clockOutVariant={status.clockOutVariant}
                                    breakVariant={status.breakVariant}
                                    disabled={isApproved || isCancelled}
                                    onNotesChange={(val) => onUpdateWorkerNotes(worker.id, val)}
                                    onRequestConfirmation={(request) => setPendingConfirmation(request)}
                                    onRemoveFromShift={() => onRemoveWorker(worker.id)}
                                />
                            );
                        })
                    )}
                </div>
            </div>

            <AlertDialog
                open={Boolean(pendingConfirmation)}
                onOpenChange={(open) => {
                    if (!open && !isSaving) {
                        setPendingConfirmation(null);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm timesheet update</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingConfirmation
                                ? `Save the following changes for ${pendingConfirmation.workerName}?`
                                : "Save these timesheet updates?"}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {pendingConfirmation ? (
                        <div className="space-y-3 text-sm">
                            {pendingConfirmation.summaries.map((summary) => (
                                <div
                                    key={summary.label}
                                    className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2"
                                >
                                    <span className="font-medium text-foreground">{summary.label}</span>
                                    <span className="text-muted-foreground">
                                        {summary.previous || "Empty"} to {summary.next || "Empty"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : null}
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmPendingChange} disabled={isSaving}>
                            {isSaving ? (
                                <>
                                    <Spinner data-icon="inline-start" />
                                    Saving...
                                </>
                            ) : (
                                "Confirm update"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
