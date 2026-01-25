import * as React from "react";
import { Clock } from "lucide-react";
import { Button } from "./button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "./popover";
import { ScrollArea, ScrollBar } from "./scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./select";
import { cn } from "../../lib/utils";
import { format, parse, addMinutes, startOfDay } from "date-fns";

// Helper to auto-calculate end time (+6 hours)
export const calculateDefaultEndTime = (startTime: string): string | undefined => {
    try {
        const startDate = parse(startTime, "HH:mm", new Date());
        const endDate = addMinutes(startDate, 6 * 60);
        return format(endDate, "HH:mm");
    } catch {
        return undefined;
    }
};

// Also export helper parse/format utilities if needed, but keeping it minimal for now.
export const parseTime = (timeStr: string) => parse(timeStr, "HH:mm", new Date());


// --- Original TimePicker (Scroll Wheel) ---

interface TimePickerProps {
    value?: string; // "05:00 PM"
    onChange?: (value: string) => void;
    className?: string;
    disabled?: boolean;
    placeholder?: string;
    onBlur?: () => void;
}

export function TimePicker({ value, onChange, className, disabled, placeholder = "Pick a time", onBlur }: TimePickerProps) {
    const [open, setOpen] = React.useState(false);

    // Parse value or default to now
    const parsedTime = React.useMemo(() => {
        if (!value) return { hour: "12", minute: "00", period: "PM" };
        const [time = "12:00", period = "PM"] = value.split(" ");
        const [hour = "12", minute = "00"] = time.split(":");
        return { hour, minute, period };
    }, [value]);

    const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, "0"));
    const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));
    const periods = ["AM", "PM"];

    const handleChange = (type: "hour" | "minute" | "period", newVal: string) => {
        const current = parsedTime;
        let newTime = { ...current, [type]: newVal };
        onChange?.(`${newTime.hour}:${newTime.minute} ${newTime.period}`);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                        "w-full justify-start text-left font-normal",
                        !value && "text-muted-foreground",
                        className
                    )}
                    disabled={disabled}
                    onBlur={onBlur}
                >
                    <Clock className="mr-2 h-4 w-4" />
                    {value || placeholder}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <div className="flex h-[200px] divide-x">
                    {/* Hours */}
                    <ScrollArea className="w-[64px]">
                        <div className="flex flex-col p-2">
                            {hours.map((h) => (
                                <Button
                                    key={h}
                                    variant="ghost"
                                    size="sm"
                                    className={cn("justify-center", parsedTime.hour === h && "bg-accent")}
                                    onClick={() => handleChange("hour", h)}
                                >
                                    {h}
                                </Button>
                            ))}
                        </div>
                        <ScrollBar orientation="vertical" />
                    </ScrollArea>

                    {/* Minutes */}
                    <ScrollArea className="w-[64px]">
                        <div className="flex flex-col p-2">
                            {minutes.map((m) => (
                                <Button
                                    key={m}
                                    variant="ghost"
                                    size="sm"
                                    className={cn("justify-center", parsedTime.minute === m && "bg-accent")}
                                    onClick={() => handleChange("minute", m)}
                                >
                                    {m}
                                </Button>
                            ))}
                        </div>
                        <ScrollBar orientation="vertical" />
                    </ScrollArea>

                    {/* Period */}
                    <ScrollArea className="w-[64px]">
                        <div className="flex flex-col p-2">
                            {periods.map((p) => (
                                <Button
                                    key={p}
                                    variant="ghost"
                                    size="sm"
                                    className={cn("justify-center", parsedTime.period === p && "bg-accent")}
                                    onClick={() => handleChange("period", p)}
                                >
                                    {p}
                                </Button>
                            ))}
                        </div>
                        <ScrollBar orientation="vertical" />
                    </ScrollArea>
                </div>
            </PopoverContent>
        </Popover>
    );
}

// --- Interval TimePicker (Dropdown 15m) ---

interface IntervalTimePickerProps {
    value?: string; // "HH:mm" 24h format
    onChange?: (value: string) => void;
    placeholder?: string;
    className?: string;
}

// Generate time options in 15-minute intervals
const generateTimeOptions = () => {
    const times: Date[] = [];
    let current = startOfDay(new Date());
    const end = addMinutes(startOfDay(new Date()), 24 * 60);

    while (current < end) {
        times.push(current);
        current = addMinutes(current, 15);
    }
    return times;
};

const TIME_OPTIONS = generateTimeOptions();

export function IntervalTimePicker({ value, onChange, placeholder = "Select time", className }: IntervalTimePickerProps) {

    // Helper to format display label
    const formatLabel = (date: Date) => format(date, "h:mm a");

    // Standard Select "onChange" provides the value (string) directly
    const handleValueChange = (val: string) => {
        onChange?.(val);
    };

    return (
        <Select value={value} onValueChange={handleValueChange}>
            <SelectTrigger className={cn("w-full h-11 rounded-full", className)}>
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent className="h-[200px]" position="popper">
                {TIME_OPTIONS.map((time) => {
                    const timeValue = format(time, "HH:mm");
                    return (
                        <SelectItem key={timeValue} value={timeValue}>
                            {formatLabel(time)}
                        </SelectItem>
                    );
                })}
            </SelectContent>
        </Select>
    );
}
