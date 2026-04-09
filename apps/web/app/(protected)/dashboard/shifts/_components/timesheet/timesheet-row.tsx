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
import { RotateCcw, Trash2 } from "lucide-react";
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
    onNotesChange?: (value: string) => void;
    onRequestConfirmation?: (request: PendingTimesheetConfirmation) => void;
    onRemoveFromShift?: () => void;
}

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) =>
    String(index + 1).padStart(2, "0"),
);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) =>
    String(index).padStart(2, "0"),
);
const PERIOD_OPTIONS: Array<TimeFieldParts["period"]> = ["AM", "PM"];
const BREAK_OPTIONS = ["0 min", "15 min", "30 min"] as const;
const EMPTY_SELECT_VALUE = "__empty__";

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

function TimeSelectField({
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
            <div
                className={cn(
                    "flex h-10 items-center gap-1.5 rounded-lg border px-1.5 shadow-sm transition-[border-color,box-shadow] focus-within:ring-1 focus-within:ring-ring",
                    getVariantClass(variant),
                    disabled && "opacity-60",
                )}
            >
                <TimePartSelect
                    ariaLabel={`${label} hour`}
                    value={value.hour}
                    placeholder="hh"
                    options={HOUR_OPTIONS}
                    onChange={(hour) => onChange({ ...value, hour })}
                    disabled={disabled}
                    triggerClassName="w-[4.1rem]"
                    contentClassName="min-w-[4.1rem]"
                />
                <span className="text-sm font-semibold text-muted-foreground">:</span>
                <TimePartSelect
                    ariaLabel={`${label} minute`}
                    value={value.minute}
                    placeholder="mm"
                    options={MINUTE_OPTIONS}
                    onChange={(minute) => onChange({ ...value, minute })}
                    disabled={disabled}
                    triggerClassName="w-[4.1rem]"
                    contentClassName="min-w-[4.1rem]"
                />
                <TimePartSelect
                    ariaLabel={`${label} period`}
                    value={value.period}
                    placeholder="AM/PM"
                    options={PERIOD_OPTIONS}
                    onChange={(period) => onChange({ ...value, period: period as TimeFieldParts["period"] })}
                    disabled={disabled}
                    triggerClassName="ml-auto w-[5.25rem]"
                    contentClassName="min-w-[5.25rem]"
                />
            </div>
        </Field>
    );
}

function TimePartSelect({
    ariaLabel,
    value,
    placeholder,
    options,
    onChange,
    disabled,
    triggerClassName,
    contentClassName,
}: {
    ariaLabel: string;
    value: string;
    placeholder: string;
    options: readonly string[];
    onChange: (value: string) => void;
    disabled?: boolean;
    triggerClassName?: string;
    contentClassName?: string;
}) {
    return (
        <Select
            value={value || EMPTY_SELECT_VALUE}
            onValueChange={(nextValue) => onChange(nextValue === EMPTY_SELECT_VALUE ? "" : nextValue)}
            disabled={disabled}
        >
            <SelectTrigger
                aria-label={ariaLabel}
                className={cn(
                    "h-8 rounded-md border-0 bg-transparent px-2 text-sm font-medium shadow-none focus-visible:border-transparent focus-visible:ring-0",
                    triggerClassName,
                )}
            >
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent position="popper" align="start" className={contentClassName}>
                <SelectItem value={EMPTY_SELECT_VALUE}>{placeholder}</SelectItem>
                {options.map((option) => (
                    <SelectItem key={option} value={option}>
                        {option}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
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
                    "rounded-lg border px-1.5 shadow-sm transition-[border-color,box-shadow] focus-within:ring-1 focus-within:ring-ring",
                    getVariantClass(variant),
                    disabled && "opacity-60",
                )}
            >
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
    onNotesChange,
    onRequestConfirmation,
    onRemoveFromShift,
}: TimesheetRowProps) {
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
                <Avatar className="size-10">
                    <AvatarImage src={workerAvatar} alt={workerName} />
                    <AvatarFallback>{workerName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-foreground">{workerName}</span>
                    <span className="text-xs text-muted-foreground">
                        {shiftDuration}
                        {draftBreakTotal !== "0 min" ? ` · ${draftBreakTotal} total break` : ""}
                    </span>
                </div>
            </div>

            <TimeSelectField
                label="Clock-in"
                value={draftClockIn}
                onChange={setDraftClockIn}
                variant={clockInVariant}
                disabled={disabled}
            />

            <TimeSelectField
                label="Clock-out"
                value={draftClockOut}
                onChange={setDraftClockOut}
                variant={clockOutVariant}
                disabled={disabled}
            />

            <BreakSelectField
                label="Break 1"
                value={draftBreakOne}
                onChange={setDraftBreakOne}
                variant={breakVariant}
                disabled={disabled}
            />

            <BreakSelectField
                label="Break 2"
                value={draftBreakTwo}
                onChange={setDraftBreakTwo}
                variant={breakVariant}
                disabled={disabled}
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
                    disabled={disabled}
                />
            </Field>

            <div className="flex flex-wrap items-center justify-end gap-2">
                {hasDirtyEdits ? <Badge variant="secondary">Unsaved</Badge> : null}
                {hasDirtyEdits ? (
                    <>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={resetDraftValues}
                            disabled={disabled}
                        >
                            <RotateCcw data-icon="inline-start" />
                            Reset
                        </Button>
                        <Button
                            size="sm"
                            onClick={requestConfirmation}
                            disabled={disabled || hasIncompleteTimeEdit}
                        >
                            Update
                        </Button>
                    </>
                ) : null}
                <Button
                    variant="outline"
                    size="sm"
                    className="text-muted-foreground hover:border-destructive/20 hover:bg-destructive/5 hover:text-destructive"
                    onClick={onRemoveFromShift}
                    disabled={disabled}
                >
                    <Trash2 data-icon="inline-start" />
                    Remove
                </Button>
            </div>
        </div>
    );
}
