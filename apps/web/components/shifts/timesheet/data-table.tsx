'use client';

import {
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@repo/ui/components/ui/table";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";

import { columns } from "./columns";
import { TimesheetWorker } from "@/lib/types";

interface TimesheetTableProps {
    data: TimesheetWorker[];
    capacity: { filled: number; total: number };
}

export function TimesheetTable({ data, capacity }: TimesheetTableProps) {
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    return (
        <section className="space-y-4">
            {/* Header / Controls */}
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-foreground">Timesheets</h2>
                    <Badge className="bg-[#ffd700] text-black hover:bg-[#ffd700]/90 border-0 font-bold rounded-full px-3">
                        {capacity.filled} of {capacity.total} filled
                    </Badge>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 text-xs font-medium border-border hover:bg-secondary rounded-full"
                        onClick={() => console.log("Open Add Pros Modal")}
                    >
                        Add Pros
                    </Button>
                </div>
            </div>

            {/* The Table */}
            <Card className="overflow-hidden border-border shadow-sm bg-card rounded-lg">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id} className="hover:bg-muted/30 border-b border-border">
                                    {headerGroup.headers.map((header) => {
                                        return (
                                            <TableHead
                                                key={header.id}
                                                className="text-xs font-bold uppercase tracking-wider text-muted-foreground h-11"
                                                style={{ width: header.getSize() }}
                                            >
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(
                                                        header.column.columnDef.header,
                                                        header.getContext()
                                                    )}
                                            </TableHead>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        data-state={row.getIsSelected() && "selected"}
                                        className="border-border hover:bg-muted/5 transition-colors"
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id} className="py-4 align-middle">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-32 text-center text-sm text-muted-foreground">
                                        No workers assigned yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </section>
    );
}
