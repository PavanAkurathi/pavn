// apps/web/components/schedule/schedule-block.tsx

"use client";

import { useEffect } from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import { format } from "date-fns";
import { CalendarIcon, Plus, MoreHorizontal, Copy, Trash, HelpCircle, X } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Switch } from "@repo/ui/components/ui/switch";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { IntervalTimePicker, calculateDefaultEndTime } from "@repo/ui/components/ui/time-picker";
import { PositionSelectorDialog, PositionItem } from "./position-selector-dialog";
import { PositionChips } from "./position-chips";
import { useState } from "react";

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
    const watchedDates = watch(`schedules.${index}.dates`); // For Standard Mode

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
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div className="space-y-1">
                    <CardTitle className="text-xl font-semibold">Date & Times</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">

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
                    <div className="space-y-4">
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
                                                    initialFocus
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
                                                    initialFocus
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
                                                    months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 w-full justify-center",
                                                }}
                                                min={1}
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
                                    placeholder="End time"
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

                <div className="flex items-center text-sm text-muted-foreground gap-1">
                    Expected breaks: {breakDuration === "0" ? "None" : `${breakDuration}m`}
                    <HelpCircle className="h-3 w-3" />
                </div>

                {/* Section 3: Positions Shell */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold">Positions</h3>

                    {fields.length > 0 && (
                        <div className="mb-4">
                            <PositionChips fields={fields} onRemove={remove} />
                        </div>
                    )}

                    <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto h-12 border-2 border-primary text-primary hover:bg-primary/5 hover:text-primary transition-colors font-medium px-8"
                        onClick={() => setIsPositionDialogOpen(true)}
                        data-testid="add-position"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Add position
                    </Button>
                </div>

                <PositionSelectorDialog
                    isOpen={isPositionDialogOpen}
                    onClose={() => setIsPositionDialogOpen(false)}
                    onSelect={handlePositionsSelect}
                    roles={roles}
                    crew={crew}
                />
            </CardContent >
        </Card >
    );
}
