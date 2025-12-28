// apps/web/components/schedule/time-picker-select.tsx

import * as React from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@repo/ui/components/ui/select";
import { FormControl } from "@repo/ui/components/ui/form";
import { addMinutes, format, parse, startOfDay } from "date-fns";

interface TimePickerSelectProps {
    value?: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
}

// Generate time options in 15-minute intervals
const generateTimeOptions = () => {
    const times: string[] = [];
    let current = startOfDay(new Date());
    const end = addMinutes(startOfDay(new Date()), 24 * 60); // 24 hours

    while (current < end) {
        times.push(format(current, "HH:mm"));
        current = addMinutes(current, 15);
    }
    return times;
};

const TIME_OPTIONS = generateTimeOptions();

// Helper to format "17:00" -> "5:00 PM"
const formatTimeLabel = (timeStr: string) => {
    try {
        const date = parse(timeStr, "HH:mm", new Date());
        return format(date, "h:mm a");
    } catch {
        return timeStr;
    }
};

export function TimePickerSelect({ value, onChange, placeholder = "Select time", disabled }: TimePickerSelectProps) {
    return (
        <Select onValueChange={onChange} defaultValue={value} value={value} disabled={disabled}>
            <FormControl>
                <SelectTrigger>
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
            </FormControl>
            <SelectContent className="h-[200px]">
                {TIME_OPTIONS.map((time) => (
                    <SelectItem key={time} value={time}>
                        {formatTimeLabel(time)}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

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
