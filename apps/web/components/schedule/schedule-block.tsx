// apps/web/components/schedule/schedule-block.tsx

"use client";

import { useEffect } from "react";
import { useFormContext, useFieldArray } from "@repo/ui/components/ui/form";
import { format } from "date-fns";
import { CalendarIcon, Plus, HelpCircle, X } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Calendar } from "@repo/ui/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import {
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@repo/ui/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@repo/ui/components/ui/select";
import { IntervalTimePicker, calculateDefaultEndTime } from "@repo/ui/components/ui/time-picker";
import { PositionSelectorDialog, PositionItem } from "./position-selector-dialog";
import { PositionChips } from "./position-chips";
import { useWorkerAvailability, isUnavailableDuring } from "@/hooks/use-worker-availability";
import { useState, useMemo } from "react";

// ... imports
import { CrewMember, Role } from "@/hooks/use-crew-data";

interface ScheduleBlockProps {
    index: number;
    onRemove: () => void;
    onDuplicate: () => void;
    canDelete: boolean;
    roles: Role[];
    crew: CrewMember[];
    isRecurring: boolean;
}

const WEEKDAYS = [
    { label: "Sun", value: 0 },
    { label: "Mon", value: 1 },
    { label: "Tue", value: 2 },
    { label: "Wed", value: 3 },
    { label: "Thu", value: 4 },
    { label: "Fri", value: 5 },
    { label: "Sat", value: 6 },
];

export function ScheduleBlock({ index, onRemove, onDuplicate, canDelete, roles, crew, isRecurring }: ScheduleBlockProps) {
    const { control, watch, setValue } = useFormContext();
    const [isPositionDialogOpen, setIsPositionDialogOpen] = useState(false);

    // Nested Field Array for Positions
    const { fields, append, remove } = useFieldArray({
        control,
        name: `schedules.${index}.positions`,
    });

    const watchStartTime = watch(`schedules.${index}.startTime`);

    // Smart End Time Logic for this specific block
    useEffect(() => {
        if (watchStartTime && !watch(`schedules.${index}.endTime`)) {
            const suggestedEnd = calculateDefaultEndTime(watchStartTime);
            if (suggestedEnd) {
                setValue(`schedules.${index}.endTime`, suggestedEnd);
            }
        }
    }, [watchStartTime, index, setValue, watch]);

    const breakDuration = watch(`schedules.${index}.breakDuration`);

    // Availability lookup for exactly the slots this block would create, so the
    // picker can warn before publish rejects the assignment outright.
    const watchDates = watch(`schedules.${index}.dates`);
    const watchEndTime = watch(`schedules.${index}.endTime`);

    const blockIntervals = useMemo(() => {
        // The calendar stores Date objects, the draft-restore path can hand back
        // ISO strings. Accept both — reading only one silently produced an empty
        // set and no availability lookup at all.
        const dates: unknown[] = Array.isArray(watchDates) ? watchDates : [];
        if (!dates.length || !watchStartTime || !watchEndTime) return [];

        const toDayString = (value: unknown): string => {
            if (value instanceof Date && !Number.isNaN(value.getTime())) {
                // Local calendar day, not UTC: toISOString() would roll a
                // late-evening local date back to the previous day.
                const month = `${value.getMonth() + 1}`.padStart(2, "0");
                const day = `${value.getDate()}`.padStart(2, "0");
                return `${value.getFullYear()}-${month}-${day}`;
            }
            if (typeof value === "string") return value.slice(0, 10);
            return "";
        };

        return dates
            .map((date) => {
                const day = toDayString(date);
                if (!day) return null;
                const start = new Date(`${day}T${watchStartTime}:00`);
                let end = new Date(`${day}T${watchEndTime}:00`);
                // Overnight block: the end time lands before the start, so it
                // belongs to the following day.
                if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
                return Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
                    ? null
                    : { start, end };
            })
            .filter((interval): interval is { start: Date; end: Date } => interval !== null);
    }, [watchDates, watchStartTime, watchEndTime]);

    // One request spanning the whole block rather than one per date.
    const availabilityRange = useMemo(() => {
        if (!blockIntervals.length) return { from: undefined, to: undefined };
        const from = new Date(Math.min(...blockIntervals.map((i) => i.start.getTime())));
        const to = new Date(Math.max(...blockIntervals.map((i) => i.end.getTime())));
        return { from: from.toISOString(), to: to.toISOString() };
    }, [blockIntervals]);

    const { availabilityByWorker } = useWorkerAvailability(availabilityRange.from, availabilityRange.to);

    const unavailableWorkerIds = useMemo(() => {
        const ids = new Set<string>();
        if (!blockIntervals.length) return ids;
        for (const [workerId, windows] of availabilityByWorker) {
            if (blockIntervals.some((i) => isUnavailableDuring(windows, i.start, i.end))) {
                ids.add(workerId);
            }
        }
        return ids;
    }, [availabilityByWorker, blockIntervals]);

    const handlePositionsSelect = (selectedItems: PositionItem[]) => {
        // Append selected positions to the Field Array
        selectedItems.forEach(item => {
            append({
                roleId: item.roleId,
                roleName: item.roleName,
                workerId: item.workerId,
                workerName: item.workerName,
                workerAvatar: item.workerAvatar,
                workerInitials: item.workerInitials
            });
        });
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div className="flex flex-col gap-1">
                    <CardTitle className="text-xl font-semibold">Date & Times</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">

                <FormField
                    control={control as any}
                    name={`schedules.${index}.scheduleName`}
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <Input placeholder="Schedule name (optional)" {...field} className="h-12" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* MODE SWITCHING UI */}
                {isRecurring ? (
                    <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={control as any}
                                name={`schedules.${index}.startDate`}
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button variant={"outline"} className={cn("w-full h-12 pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                        {field.value ? format(field.value, "PPP") : <span>Start date</span>}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value}
                                                    onSelect={field.onChange}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={control as any}
                                name={`schedules.${index}.endDate`}
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button variant={"outline"} className={cn("w-full h-12 pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                        {field.value ? format(field.value, "PPP") : <span>End date</span>}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value}
                                                    onSelect={field.onChange}
                                                    disabled={(date) => {
                                                        const start = watch(`schedules.${index}.startDate`);
                                                        return start ? date < start : false;
                                                    }}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Shift Days Selector */}
                        <FormField
                            control={control as any}
                            name={`schedules.${index}.daysOfWeek`}
                            render={({ field }) => (
                                <FormItem>
                                    <Label className="text-sm font-medium mb-2 block text-muted-foreground">Shift days</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {WEEKDAYS.map((day) => {
                                            const isSelected = field.value?.includes(day.value);
                                            return (
                                                <Button
                                                    key={day.value}
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => {
                                                        const current = field.value || [];
                                                        if (isSelected) {
                                                            field.onChange(current.filter((d: number) => d !== day.value));
                                                        } else {
                                                            field.onChange([...current, day.value]);
                                                        }
                                                    }}
                                                    className={cn(
                                                        "h-10 w-10 rounded-full p-0 transition-all font-medium",
                                                        isSelected
                                                            ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground"
                                                            : "bg-background hover:bg-muted text-muted-foreground hover:text-foreground"
                                                    )}
                                                >
                                                    {day.label}
                                                </Button>
                                            )
                                        })}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                ) : (
                    // STANDARD MODE (Multi-select)
                    <FormField
                        control={control as any}
                        name={`schedules.${index}.dates`}
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                                variant={"outline"}
                                                data-testid="dates-trigger"
                                                className={cn(
                                                    "w-full pl-3 text-left font-normal min-h-12 h-auto py-2 flex justify-between items-center",
                                                    (!field.value || field.value.length === 0) && "text-muted-foreground"
                                                )}
                                            >
                                                {field.value && field.value.length > 0 ? (
                                                    <div className="flex flex-wrap gap-2 items-center">
                                                        {field.value.sort((a: Date, b: Date) => a.getTime() - b.getTime()).slice(0, 4).map((date: Date) => (
                                                            <div key={date.toISOString()} className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 group">
                                                                {format(date, "MMM d")}
                                                                <div
                                                                    role="button"
                                                                    className="hover:bg-background/20 rounded-full p-0.5 cursor-pointer"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        field.onChange(field.value.filter((d: Date) => d.getTime() !== date.getTime()));
                                                                    }}
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {field.value.length > 4 && (
                                                            <div className="bg-muted text-muted-foreground px-2 py-1 rounded-md text-xs font-medium">
                                                                +{field.value.length - 4} more
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span>Select date(s)</span>
                                                )}
                                                <CalendarIcon className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <div className="p-2 bg-background border rounded-md">
                                            <Calendar
                                                mode="multiple"
                                                selected={field.value || []}
                                                onSelect={field.onChange}
                                                className="rounded-md border-0"
                                                classNames={{
                                                    months: "flex w-full flex-col justify-center gap-4 sm:flex-row",
                                                }}
                                                min={1}
                                                disabled={{ before: new Date() }}
                                            />
                                            {field.value?.length > 0 && (
                                                <div className="p-2 border-t flex justify-end">
                                                    <Button variant="ghost" size="sm" onClick={() => field.onChange([])}>Clear Selection</Button>
                                                </div>
                                            )}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                {/* Section 2: Times */}
                <div className="grid grid-cols-3 gap-4">
                    <FormField
                        control={control as any}
                        name={`schedules.${index}.startTime`}
                        render={({ field }) => (
                            <FormItem>
                                <IntervalTimePicker
                                    value={field.value}
                                    onChange={field.onChange}
                                    placeholder="Start time"
                                    className="start-time-picker"
                                />
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={control as any}
                        name={`schedules.${index}.endTime`}
                        render={({ field }) => (
                            <FormItem>
                                <IntervalTimePicker
                                    value={field.value}
                                    onChange={field.onChange}
                                    placeholder="End Time"
                                    className="end-time-picker"
                                />
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={control as any}
                        name={`schedules.${index}.breakDuration`}
                        render={({ field }) => (
                            <FormItem>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="h-12">
                                            <SelectValue placeholder="Break time" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="0">Total unpaid break</SelectItem>
                                        <SelectItem value="15">15m</SelectItem>
                                        <SelectItem value="30">30m</SelectItem>
                                        <SelectItem value="45">45m</SelectItem>
                                        <SelectItem value="60">60m</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <Badge variant="secondary" className="w-fit gap-1">
                    Expected breaks: {breakDuration === "0" ? "None" : `${breakDuration}m`}
                    <HelpCircle className="h-3 w-3" />
                </Badge>

                {/* Section 3: Positions Shell */}
                <div className="flex flex-col gap-4">
                    <h3 className="text-sm font-bold">Positions</h3>

                    {fields.length > 0 && (
                        <div className="mb-4">
                            <PositionChips fields={fields} onRemove={remove} />
                        </div>
                    )}

                    <Button
                        type="button"
                        variant="outline"
                        className="h-12 w-full border-dashed sm:w-auto"
                        onClick={() => setIsPositionDialogOpen(true)}
                        data-testid="add-position"
                    >
                        <Plus data-icon="inline-start" className="h-4 w-4" />
                        Add position
                    </Button>
                </div>

                <PositionSelectorDialog
                    isOpen={isPositionDialogOpen}
                    onClose={() => setIsPositionDialogOpen(false)}
                    onSelect={handlePositionsSelect}
                    roles={roles}
                    crew={crew}
                    unavailableWorkerIds={unavailableWorkerIds}
                />
            </CardContent >
        </Card >
    );
}
