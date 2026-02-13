// apps/web/components/shifts/timesheet/shift-summary-header.tsx

import * as React from "react";
import { Button } from "@repo/ui/components/ui/button";

interface ShiftSummaryHeaderProps {
    title: string;
    role: string;
    // rate: string; // REMOVED per TICKET-005/008
    date: string;
    location: string;
    timeRange: string;
    breakDuration: string;
    createdBy: string;
    createdAt: string;
}

export function ShiftSummaryHeader({
    title,
    role,
    // rate, // REMOVED per TICKET-005/008
    date, location,
    timeRange,
    breakDuration,
    createdBy,
    createdAt,
}: ShiftSummaryHeaderProps) {
    return (
        <div className="flex flex-col gap-4 py-2">
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                    <div className="text-muted-foreground">{role}</div>
                </div>
                <Button variant="outline" className="text-zinc-700 border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900">
                    Book again
                </Button>
            </div>

            <div className="space-y-1 text-sm">
                <div>{date} • {location} • {role}</div>
                <div className="font-medium">{timeRange} <span className="font-normal text-muted-foreground ml-2">{breakDuration}</span></div>
            </div>

            <div className="text-xs text-muted-foreground pt-2">
                Created by: {createdBy} on {createdAt}
            </div>
        </div>
    );
}
