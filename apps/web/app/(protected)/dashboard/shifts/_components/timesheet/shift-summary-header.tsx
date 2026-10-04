// apps/web/components/shifts/timesheet/shift-summary-header.tsx

import * as React from "react";

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
    /** "published" fills grey, "draft" is dashed; anything else shows no pill. */
    pill?: "published" | "draft";
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
    pill,
}: ShiftSummaryHeaderProps) {
    return (
        <div className="flex flex-col gap-1.5 py-1">
            <div className="flex flex-wrap items-center gap-3">
                {pill ? (
                    <span
                        className={
                            pill === "draft"
                                ? "whitespace-nowrap rounded-full border-[1.5px] border-dashed border-border px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-muted-foreground"
                                : "whitespace-nowrap rounded-full bg-muted px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-foreground/80"
                        }
                    >
                        {pill}
                    </span>
                ) : null}
                <h1 className="text-[23px] font-extrabold tracking-tight text-foreground">{title}</h1>
            </div>

            <div className="text-[13.5px] leading-[1.7] text-muted-foreground">
                <div>
                    {date} · {timeRange}
                </div>
                <div>{location}</div>
                <div>
                    {role} · {breakDuration}
                </div>
                {createdAt ? (
                    <div>{createdBy ? `Created by ${createdBy} on ${createdAt}` : `Created ${createdAt}`}</div>
                ) : null}
            </div>

            {/* Only shown when the two differ — otherwise it is noise. The shift
                time above is the location's; this is the reader's own clock, so
                a manager scheduling across zones is never guessing which. */}
            {viewerTimeRange ? (
                <div className="text-[13.5px] text-muted-foreground">
                    Your time{viewerZoneLabel ? ` (${viewerZoneLabel})` : ""}: {viewerTimeRange}
                </div>
            ) : null}
        </div>
    );
}
