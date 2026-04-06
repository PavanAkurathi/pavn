import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@repo/ui/components/ui/select";
import { Input } from "@repo/ui/components/ui/input";
import { MessageSquareText, MoreHorizontal, Trash2 } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

type StatusVariant = "default" | "destructive" | "warning";

interface TimesheetRowProps {
    workerName: string;
    workerAvatar?: string;
    shiftDuration: string;
    clockIn: string; // "05:00 PM"
    clockOut: string; // "11:35 PM"
    breakDuration: string; // "0 min"
    breakOneDuration: string;
    breakTwoDuration: string;
    notes?: string;
    clockInVariant?: StatusVariant;
    clockOutVariant?: StatusVariant;
    breakVariant?: StatusVariant;
    disabled?: boolean;
    onClockInChange?: (value: string) => void;
    onClockOutChange?: (value: string) => void;
    onBreakOneChange?: (value: string) => void;
    onBreakTwoChange?: (value: string) => void;
    onSave?: (field: string, value: any) => void;
    onEditNotes?: () => void;
    onRemoveFromShift?: () => void;
}

const getVariantClass = (variant: StatusVariant = "default") => {
    switch (variant) {
        case "destructive":
            return "border-destructive ring-destructive/20 focus-visible:ring-destructive";
        case "warning":
            return "border-amber-500 ring-amber-500/20 focus-visible:ring-amber-500";
        default:
            return "";
    }
};

export function TimesheetRow({
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
    onClockInChange,
    onClockOutChange,
    onBreakOneChange,
    onBreakTwoChange,
    onEditNotes,
    onRemoveFromShift,
    onSave,
}: TimesheetRowProps) {
    return (
        <div className={cn(
            "flex flex-col gap-4 border-b border-border py-4 last:border-0 md:flex-row md:items-center md:justify-between",
            disabled && "opacity-60 pointer-events-none" // Global disable visual
        )}>
            {/* 1. Name & Avatar */}
            <div className="flex items-center gap-3 md:w-[250px]">
                <Avatar className="h-12 w-12">
                    <AvatarImage src={workerAvatar} alt={workerName} />
                    <AvatarFallback>{workerName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                    <span className="font-medium">{workerName}</span>
                    <span className="text-sm text-muted-foreground">
                        {shiftDuration}
                        {breakDuration && breakDuration !== "0 min" ? ` · ${breakDuration} total break` : ""}
                    </span>
                </div>
            </div>

            {/* 2. Clock In */}
            <div className="flex flex-col gap-1.5 md:w-[150px]">
                <span className="text-xs text-muted-foreground md:hidden">Clock-in</span>
                <Input
                    value={clockIn}
                    onChange={(event) => onClockInChange?.(event.target.value)}
                    onBlur={() => onSave?.('clockIn', clockIn)}
                    className={cn("h-10 rounded-full font-mono text-sm", getVariantClass(clockInVariant))}
                    disabled={disabled}
                    placeholder="hh:mm am"
                />
            </div>

            {/* 3. Clock Out */}
            <div className="flex flex-col gap-1.5 md:w-[150px]">
                <span className="text-xs text-muted-foreground md:hidden">Clock-out</span>
                <Input
                    value={clockOut}
                    onChange={(event) => onClockOutChange?.(event.target.value)}
                    onBlur={() => onSave?.('clockOut', clockOut)}
                    className={cn("h-10 rounded-full font-mono text-sm", getVariantClass(clockOutVariant))}
                    disabled={disabled}
                    placeholder="hh:mm am"
                />
            </div>

            {/* 4. Break 1 */}
            <div className="flex flex-col gap-1.5 md:w-[150px]">
                <span className="text-xs text-muted-foreground md:hidden">Break 1</span>
                <Select
                    value={breakOneDuration}
                    onValueChange={(val) => {
                        onBreakOneChange?.(val);
                        onSave?.("breakOneDuration", val);
                    }}
                    disabled={disabled}
                >
                    <SelectTrigger className={cn("rounded-full font-mono text-sm", getVariantClass(breakVariant))}>
                        <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="0 min">0 min</SelectItem>
                        <SelectItem value="15 min">15 min</SelectItem>
                        <SelectItem value="30 min">30 min</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* 5. Break 2 */}
            <div className="flex flex-col gap-1.5 md:w-[150px]">
                <span className="text-xs text-muted-foreground md:hidden">Break 2</span>
                <Select
                    value={breakTwoDuration}
                    onValueChange={(val) => {
                        onBreakTwoChange?.(val);
                        onSave?.("breakTwoDuration", val);
                    }}
                    disabled={disabled}
                >
                    <SelectTrigger className={cn("rounded-full font-mono text-sm", getVariantClass(breakVariant))}>
                        <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="0 min">0 min</SelectItem>
                        <SelectItem value="15 min">15 min</SelectItem>
                        <SelectItem value="30 min">30 min</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* 6. Notes */}
            <div className="flex flex-col gap-1.5 md:w-[150px]">
                <span className="text-xs text-muted-foreground md:hidden">Notes</span>
                <Button
                    variant="outline"
                    size="sm"
                    className="justify-start rounded-full"
                    onClick={onEditNotes}
                    disabled={disabled}
                >
                    <MessageSquareText className="mr-2 h-4 w-4" />
                    {notes ? "Edit note" : "Add note"}
                </Button>
            </div>

            {/* 7. Row Actions */}
            <div className="flex items-center gap-2 md:ml-auto">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" disabled={disabled}>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={onEditNotes}>
                            <MessageSquareText className="mr-2 h-4 w-4" />
                            {notes ? "Edit note" : "Write note"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={onRemoveFromShift}
                            className="text-destructive focus:text-destructive"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove from shift
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
