import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import { TimePicker } from "@repo/ui/components/ui/time-picker";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@repo/ui/components/ui/select";
import { Input } from "@repo/ui/components/ui/input";
import { Map, Star, ClipboardEdit } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

type StatusVariant = "default" | "destructive" | "warning";

interface TimesheetRowProps {
    workerName: string;
    workerAvatar?: string;
    shiftDuration: string;
    hourlyRate: string;
    clockIn: string; // "05:00 PM"
    clockOut: string; // "11:35 PM"
    breakDuration: string; // "0 min"
    rating?: number;
    clockInVariant?: StatusVariant;
    clockOutVariant?: StatusVariant;
    breakVariant?: StatusVariant;
    disabled?: boolean;
    onAddToRoster?: () => void;
    onReturn?: () => void;
    onBlock?: () => void;
    onClockInChange?: (value: string) => void;
    onClockOutChange?: (value: string) => void;
    onBreakChange?: (value: string) => void;
    onRatingChange?: (rating: number) => void;
    onWriteUp?: () => void;
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
    hourlyRate,
    clockIn,
    clockOut,
    breakDuration,
    rating,
    clockInVariant = "default",
    clockOutVariant = "default",
    breakVariant = "default",
    disabled = false,
    onAddToRoster,
    onReturn,
    onBlock,
    onClockInChange,
    onClockOutChange,
    onBreakChange,
    onRatingChange,
    onWriteUp,
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
                    <span className="text-sm text-muted-foreground">{shiftDuration}, {hourlyRate}</span>
                </div>
            </div>

            {/* 2. Clock In */}
            <div className="flex flex-col gap-1.5 md:w-[150px]">
                <span className="text-xs text-muted-foreground md:hidden">Clock-in</span>
                <TimePicker
                    value={clockIn}
                    onChange={onClockInChange}
                    className={cn("font-mono text-sm", getVariantClass(clockInVariant))}
                    disabled={disabled}
                    placeholder="00:00"
                />
            </div>

            {/* 3. Clock Out */}
            <div className="flex flex-col gap-1.5 md:w-[150px]">
                <span className="text-xs text-muted-foreground md:hidden">Clock-out</span>
                <TimePicker
                    value={clockOut}
                    onChange={onClockOutChange}
                    className={cn("font-mono text-sm", getVariantClass(clockOutVariant))}
                    disabled={disabled}
                    placeholder="00:00"
                />
            </div>

            {/* 4. Total Unpaid Break */}
            <div className="flex flex-col gap-1.5 md:w-[150px]">
                <span className="text-xs text-muted-foreground md:hidden">Break</span>
                <Select value={breakDuration} onValueChange={onBreakChange} disabled={disabled}>
                    <SelectTrigger className={cn("rounded-full font-mono text-sm", getVariantClass(breakVariant))}>
                        <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="0 min">0 min</SelectItem>
                        <SelectItem value="10 min">10 min</SelectItem>
                        <SelectItem value="15 min">15 min</SelectItem>
                        <SelectItem value="30 min">30 min</SelectItem>
                        <SelectItem value="45 min">45 min</SelectItem>
                        <SelectItem value="1 hr">1 hr</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* 5. Rating */}
            <div className="flex flex-col gap-1.5 md:w-[120px]">
                <span className="text-xs text-muted-foreground md:hidden">Rating</span>
                <div className="flex items-center gap-1 justify-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            onClick={() => onRatingChange?.(star)}
                            className="focus:outline-none disabled:cursor-not-allowed"
                            type="button"
                            disabled={disabled}
                        >
                            <Star
                                className={cn(
                                    "h-5 w-5 transition-colors",
                                    star <= (rating || 0)
                                        ? "fill-yellow-400 text-yellow-400"
                                        : "fill-muted/20 text-muted-foreground/40 hover:text-yellow-400/50"
                                )}
                            />
                        </button>
                    ))}
                </div>
            </div>

            {/* 6. Write Up */}
            <div className="flex flex-col gap-1.5 md:w-[100px]">
                <span className="text-xs text-muted-foreground md:hidden">Write Up</span>
                <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-muted-foreground hover:text-foreground"
                    onClick={onWriteUp}
                    disabled={disabled}
                >
                    <ClipboardEdit className="mr-2 h-4 w-4" />
                    Write Up
                </Button>
            </div>

            {/* 7. Contact Actions (Right Side) */}
            <div className="flex items-center gap-2 md:ml-auto">
                <Button variant="outline" size="icon" className="h-9 w-9">
                    <Map className="h-4 w-4 text-muted-foreground" />
                </Button>
            </div>
        </div>
    );
}
