// apps/web/components/shifts/timesheet/shift-summary-header.tsx

import * as React from "react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Separator } from "@repo/ui/components/ui/separator";

interface ShiftSummaryHeaderProps {
    title: string;
    role: string;
    // rate: string; // REMOVED per TICKET-005/008
    date: string;
    location: string;
    timeRange: string;
    /** The reader's own clock, when it differs from the shift's zone. */
    viewerTimeRange?: string;
    viewerZoneLabel?: string;
    breakDuration: string;
    createdBy?: string;
    createdAt?: string;
}

export function ShiftSummaryHeader({
    title,
    role,
    date,
    location,
    timeRange,
    viewerTimeRange,
    viewerZoneLabel,
    breakDuration,
    createdBy,
    createdAt,
}: ShiftSummaryHeaderProps) {
    return (
        <div className="flex flex-col gap-4 py-1">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{role}</Badge>
                        <Badge variant="secondary">{breakDuration}</Badge>
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                        <div className="text-sm text-muted-foreground">{date} · {location}</div>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-foreground">{timeRange}</span>
                <Separator orientation="vertical" className="hidden h-4 sm:block" />
                {createdAt ? (
                    <span className="text-muted-foreground">
                        {createdBy ? `Created by ${createdBy} on ${createdAt}` : `Created ${createdAt}`}
                    </span>
                ) : null}
            </div>

            {/* Only shown when the two differ — otherwise it is noise. The shift
                time above is the location's; this is the reader's own clock, so
                a manager scheduling across zones is never guessing which. */}
            {viewerTimeRange ? (
                <div className="text-sm text-muted-foreground">
                    Your time{viewerZoneLabel ? ` (${viewerZoneLabel})` : ""}: {viewerTimeRange}
                </div>
            ) : null}
        </div>
    );
}
