"use client";

import * as React from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@repo/ui/components/ui/select";
import { cn } from "@repo/ui/lib/utils";
import { format, startOfDay, addMinutes, parse, isValid } from "date-fns";

interface SmartTimePickerProps {
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

export function SmartTimePicker({ value, onChange, placeholder = "Select time", className }: SmartTimePickerProps) {

    // We need to map the incoming 24h value "HH:mm" to the same format in Select list
    // The SelectItem value will be "HH:mm"

    // If value is missing, Select uses placeholder.
    // If value is present, it should match one of the options.

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

