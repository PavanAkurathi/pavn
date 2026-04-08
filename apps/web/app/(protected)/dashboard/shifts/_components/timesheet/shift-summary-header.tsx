// apps/web/components/shifts/timesheet/shift-summary-header.tsx

import * as React from "react";
import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import { Separator } from "@repo/ui/components/ui/separator";
import { getCreateScheduleHref } from "@/lib/routes";

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
    date,
    location,
    timeRange,
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
                <Button asChild variant="outline" className="self-start">
                    <Link href={getCreateScheduleHref()}>Book again</Link>
                </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-foreground">{timeRange}</span>
                <Separator orientation="vertical" className="hidden h-4 sm:block" />
                <span className="text-muted-foreground">
                    Created by {createdBy} on {createdAt}
                </span>
            </div>
        </div>
    );
}
