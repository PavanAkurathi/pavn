import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Field, FieldLabel } from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@repo/ui/components/ui/select";
import {
    Check,
    Hourglass,
    MapPin,
    Pencil,
    Phone,
    RotateCcw,
    Trash2,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

import {
    combineBreakDurations,
    formatDisplayTimeParts,
    isCompleteTimeParts,
    parseDisplayTimeParts,
    type TimeFieldParts,
    type TimesheetViewModel,
} from "@/lib/timesheet-utils";

type StatusVariant = "default" | "destructive" | "warning";

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

interface TimesheetRowProps {
    workerId: string;
    workerName: string;
    workerAvatar?: string;
    shiftDuration: string;
    clockIn: string;
    clockOut: string;
    breakDuration: string;
    breakOneDuration: string;
    breakTwoDuration: string;
    notes?: string;
    clockInVariant?: StatusVariant;
    clockOutVariant?: StatusVariant;
    breakVariant?: StatusVariant;
    disabled?: boolean;
    /** True before the shift starts: time/break/notes are locked, but the
     *  worker can still be managed (removed, renamed, called). */
    timesReadOnly?: boolean;
    isTemp?: boolean;
    agency?: string;
    phone?: string;
    invitePending?: boolean;
    onNotesChange?: (value: string) => void;
    onRequestConfirmation?: (request: PendingTimesheetConfirmation) => void;
    onRemoveFromShift?: () => void;
    onRenameTemp?: (name: string) => void;
}

// Instawork's timesheet uses a native <input type="time">, and it is the right
// call: one field, the platform's own keyboard and validation, and no bespoke
// hour/minute/period select stack to keep in sync.
const BREAK_OPTIONS = ["0 min", "15 min", "30 min", "45 min", "60 min", "90 min", "120 min"] as const;

const getVariantClass = (variant: StatusVariant = "default") => {
    switch (variant) {
        case "destructive":
            return "border-destructive/60 bg-destructive/5";
        case "warning":
            return "border-amber-300 bg-amber-50/70";
        default:
            return "border-input bg-background";
    }
};

function timePartsTo24h(parts: TimeFieldParts): string {
    if (!parts.hour || !parts.minute || !parts.period) return "";
    let h = parseInt(parts.hour, 10);
    if (parts.period === "PM" && h < 12) h += 12;
    if (parts.period === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${parts.minute}`;
}

function time24hToParts(val: string): TimeFieldParts {
    if (!val) return { hour: "", minute: "", period: "AM" };
    const [hStr, mStr] = val.split(":");
    let h = parseInt(hStr || "0", 10);
    const period: TimeFieldParts["period"] = h >= 12 ? "PM" : "AM";
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return { hour: String(h).padStart(2, "0"), minute: mStr || "00", period };
}

function TimeInputField({
    label,
    value,
    onChange,
    variant = "default",
    disabled = false,
}: {
    label: string;
    value: TimeFieldParts;
    onChange: (value: TimeFieldParts) => void;
    variant?: StatusVariant;
    disabled?: boolean;
}) {
    return (
        <Field className="gap-1.5 md:w-full">
            <FieldLabel className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground md:hidden">
                {label}
            </FieldLabel>
            <input
                type="time"
                aria-label={label}
                value={timePartsTo24h(value)}
                onChange={(event) => onChange(time24hToParts(event.target.value))}
                disabled={disabled}
                className={cn(
                    "h-10 w-full rounded-lg border px-2.5 text-sm font-medium shadow-sm transition-[border-color,box-shadow] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    getVariantClass(variant),
                    disabled && "opacity-60",
                )}
            />
        </Field>
    );
}

function BreakSelectField({
    label,
    value,
    onChange,
    variant = "default",
    disabled = false,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    variant?: StatusVariant;
    disabled?: boolean;
}) {
    return (
        <Field className="gap-1.5 md:w-full">
            <FieldLabel className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground md:hidden">
                {label}
            </FieldLabel>
            <div
                className={cn(
                    "flex items-center rounded-lg border px-1.5 shadow-sm transition-[border-color,box-shadow] focus-within:ring-1 focus-within:ring-ring bg-muted/30",
                    getVariantClass(variant),
                    disabled && "opacity-60",
                )}
            >
                <Hourglass className="ml-1 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <Select value={value} onValueChange={onChange} disabled={disabled}>
                    <SelectTrigger
                        aria-label={label}
                        className="h-10 w-full rounded-md border-0 bg-transparent px-2 text-sm font-medium shadow-none focus-visible:border-transparent focus-visible:ring-0"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" align="start">
                        {BREAK_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                                {option}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </Field>
    );
}

export function TimesheetRow({
    workerId,
    workerName,
    workerAvatar,
    shiftDuration,
    clockIn,
    clockOut,
    breakDuration,
    breakOneDuration,
    breakTwoDuration,
    notes,
    clockInVariant = "default",
    clockOutVariant = "default",
    breakVariant = "default",
    disabled = false,
    timesReadOnly = false,
    isTemp = false,
    agency,
    phone,
    invitePending = false,
    onNotesChange,
    onRequestConfirmation,
    onRemoveFromShift,
    onRenameTemp,
}: TimesheetRowProps) {
    const fieldsDisabled = disabled || timesReadOnly;
    const [isRenaming, setIsRenaming] = React.useState(false);
    const [renameDraft, setRenameDraft] = React.useState("");

    const submitRename = () => {
        const next = renameDraft.trim();
        if (next && onRenameTemp) onRenameTemp(next);
        setIsRenaming(false);
        setRenameDraft("");
    };
    const [draftClockIn, setDraftClockIn] = React.useState(() => parseDisplayTimeParts(clockIn));
    const [draftClockOut, setDraftClockOut] = React.useState(() => parseDisplayTimeParts(clockOut));
    const [draftBreakOne, setDraftBreakOne] = React.useState(breakOneDuration || "0 min");
    const [draftBreakTwo, setDraftBreakTwo] = React.useState(breakTwoDuration || "0 min");

    React.useEffect(() => {
        setDraftClockIn(parseDisplayTimeParts(clockIn));
    }, [clockIn]);

    React.useEffect(() => {
        setDraftClockOut(parseDisplayTimeParts(clockOut));
    }, [clockOut]);

    React.useEffect(() => {
        setDraftBreakOne(breakOneDuration || "0 min");
    }, [breakOneDuration]);

    React.useEffect(() => {
        setDraftBreakTwo(breakTwoDuration || "0 min");
    }, [breakTwoDuration]);

    const formattedDraftClockIn = formatDisplayTimeParts(draftClockIn);
    const formattedDraftClockOut = formatDisplayTimeParts(draftClockOut);
    const draftBreakTotal = `${combineBreakDurations({
        breakOneDuration: draftBreakOne,
        breakTwoDuration: draftBreakTwo,
    })} min`;

    const hasClockInChange = formattedDraftClockIn !== clockIn;
    const hasClockOutChange = formattedDraftClockOut !== clockOut;
    const hasBreakOneChange = draftBreakOne !== breakOneDuration;
    const hasBreakTwoChange = draftBreakTwo !== breakTwoDuration;
    const hasDirtyEdits =
        hasClockInChange || hasClockOutChange || hasBreakOneChange || hasBreakTwoChange;
    const hasIncompleteClockInEdit = Boolean(
        (draftClockIn.hour || draftClockIn.minute || draftClockIn.period) &&
            !isCompleteTimeParts(draftClockIn),
    );
    const hasIncompleteClockOutEdit = Boolean(
        (draftClockOut.hour || draftClockOut.minute || draftClockOut.period) &&
            !isCompleteTimeParts(draftClockOut),
    );
    const hasIncompleteTimeEdit = hasIncompleteClockInEdit || hasIncompleteClockOutEdit;

    const resetDraftValues = () => {
        setDraftClockIn(parseDisplayTimeParts(clockIn));
        setDraftClockOut(parseDisplayTimeParts(clockOut));
        setDraftBreakOne(breakOneDuration || "0 min");
        setDraftBreakTwo(breakTwoDuration || "0 min");
    };

    const requestConfirmation = () => {
        const changes: PendingTimesheetConfirmation["changes"] = {};
        const summaries: PendingTimesheetConfirmation["summaries"] = [];

        if (hasClockInChange && formattedDraftClockIn) {
            changes.clockIn = formattedDraftClockIn;
            summaries.push({
                label: "Clock-in",
                previous: clockIn || "Empty",
                next: formattedDraftClockIn,
            });
        }

        if (hasClockOutChange && formattedDraftClockOut) {
            changes.clockOut = formattedDraftClockOut;
            summaries.push({
                label: "Clock-out",
                previous: clockOut || "Empty",
                next: formattedDraftClockOut,
            });
        }

        if (hasBreakOneChange) {
            changes.breakOneDuration = draftBreakOne;
            summaries.push({
                label: "Break 1",
                previous: breakOneDuration,
                next: draftBreakOne,
            });
        }

        if (hasBreakTwoChange) {
            changes.breakTwoDuration = draftBreakTwo;
            summaries.push({
                label: "Break 2",
                previous: breakTwoDuration,
                next: draftBreakTwo,
            });
        }

        if (!summaries.length) {
            return;
        }

        onRequestConfirmation?.({
            workerId,
            workerName,
            changes,
            summaries,
        });
    };

    return (
        <div
            className={cn(
                "grid gap-3 border-b border-border/60 py-3 last:border-0 md:grid-cols-[minmax(220px,1.45fr)_148px_148px_116px_116px_minmax(160px,1fr)_148px] md:items-center md:gap-3.5",
                disabled && "opacity-60",
            )}
        >
            <div className="flex min-w-0 items-center gap-3 pr-2">
                <Avatar className={cn("size-10", isTemp && "border border-dashed border-border")}>
                    <AvatarImage src={workerAvatar} alt={workerName} />
                    <AvatarFallback>{workerName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                    {isRenaming ? (
                        <div className="flex items-center gap-1.5">
                            <Input
                                autoFocus
                                value={renameDraft}
                                onChange={(e) => setRenameDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") submitRename();
                                    if (e.key === "Escape") setIsRenaming(false);
                                }}
                                placeholder="Real name"
                                className="h-8 max-w-[160px] text-sm"
                            />
                            <Button size="icon" variant="ghost" className="size-7" aria-label="Save name" onClick={submitRename}>
                                <Check aria-hidden="true" className="size-3.5" />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1">
                            <span className="truncate font-medium text-foreground">{workerName}</span>
                            {isTemp && onRenameTemp ? (
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-6 shrink-0 text-muted-foreground"
                                    aria-label={`Rename ${workerName}`}
                                    onClick={() => {
                                        setRenameDraft(workerName.startsWith("Temp ") ? "" : workerName);
                                        setIsRenaming(true);
                                    }}
                                >
                                    <Pencil aria-hidden="true" className="size-3.5" />
                                </Button>
                            ) : null}
                            {phone ? (
                                <Button asChild size="icon" variant="ghost" className="size-6 shrink-0 text-muted-foreground" aria-label={`Call ${workerName}`}>
                                    <a href={`tel:${phone}`}><Phone aria-hidden="true" className="size-3.5" /></a>
                                </Button>
                            ) : null}
                        </div>
                    )}
                    <span className="truncate text-xs text-muted-foreground">
                        {isTemp
                            ? (agency || "Temp worker")
                            : invitePending
                                ? "Invite pending"
                                : `${shiftDuration}${draftBreakTotal !== "0 min" ? ` · ${draftBreakTotal} total break` : ""}`}
                    </span>
                </div>
            </div>

            <TimeInputField
                label="Clock-in"
                value={draftClockIn}
                onChange={setDraftClockIn}
                variant={clockInVariant}
                disabled={fieldsDisabled}
            />

            <TimeInputField
                label="Clock-out"
                value={draftClockOut}
                onChange={setDraftClockOut}
                variant={clockOutVariant}
                disabled={fieldsDisabled}
            />

            <BreakSelectField
                label="Break 1"
                value={draftBreakOne}
                onChange={setDraftBreakOne}
                variant={breakVariant}
                disabled={fieldsDisabled}
            />

            <BreakSelectField
                label="Break 2"
                value={draftBreakTwo}
                onChange={setDraftBreakTwo}
                variant={breakVariant}
                disabled={fieldsDisabled}
            />

            <Field className="gap-1.5 md:w-full">
                <FieldLabel className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground md:hidden">
                    Notes
                </FieldLabel>
                <Input
                    value={notes || ""}
                    onChange={(event) => onNotesChange?.(event.target.value)}
                    className="h-10 rounded-lg bg-background text-sm shadow-sm"
                    placeholder="Add note"
                    disabled={fieldsDisabled}
                />
            </Field>

            <div className="flex flex-wrap items-center justify-end gap-1.5">
                {phone ? (
                    <Button asChild size="icon" variant="outline" className="size-8 text-muted-foreground hover:text-foreground" aria-label={`Call ${workerName}`}>
                        <a href={`tel:${phone}`}><Phone className="size-3.5" /></a>
                    </Button>
                ) : null}
                <Button size="icon" variant="outline" className="size-8 text-muted-foreground hover:text-foreground" aria-label="View worker location" title="Worker Geofence / Location">
                    <MapPin className="size-3.5" />
                </Button>
                {hasDirtyEdits ? <Badge variant="secondary" className="mr-1">Unsaved</Badge> : null}
                {hasDirtyEdits ? (
                    <>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={resetDraftValues}
                            disabled={fieldsDisabled}
                        >
                            <RotateCcw data-icon="inline-start" className="size-3.5" />
                            Reset
                        </Button>
                        <Button
                            size="sm"
                            onClick={requestConfirmation}
                            disabled={fieldsDisabled || hasIncompleteTimeEdit}
                        >
                            Update
                        </Button>
                    </>
                ) : null}
                <Button
                    variant="outline"
                    size="icon"
                    className="size-8 text-muted-foreground hover:border-destructive/20 hover:bg-destructive/5 hover:text-destructive"
                    onClick={onRemoveFromShift}
                    disabled={disabled}
                    title="Remove worker from shift"
                    aria-label="Remove worker from shift"
                >
                    <Trash2 className="size-3.5" />
                </Button>
            </div>
        </div>
    );
}
