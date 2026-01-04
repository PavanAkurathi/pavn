// apps/web/components/schedule/schedule-block.tsx

"use client";

import { useEffect } from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import { format } from "date-fns";
import { CalendarIcon, Plus, MoreHorizontal, Copy, Trash, HelpCircle } from "lucide-react";
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
}

export function ScheduleBlock({ index, onRemove, onDuplicate, canDelete, roles, crew }: ScheduleBlockProps) {
    const { control, watch, setValue } = useFormContext();
    const [isPositionDialogOpen, setIsPositionDialogOpen] = useState(false);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

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
                <CardTitle className="text-xl font-bold">Build your schedule</CardTitle>
                <div className="flex items-center space-x-2">
                    <Label htmlFor={`recurring-${index}`} className="text-sm font-normal text-muted-foreground">Recurring schedule</Label>
                    <Switch id={`recurring-${index}`} disabled />
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Section 1: Name & Date & Actions */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">Date & Times</span>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={onDuplicate}>
                                    <Copy className="mr-2 h-4 w-4" />
                                    Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={onRemove}
                                    disabled={!canDelete}
                                    className="text-red-600 focus:text-red-600"
                                >
                                    <Trash className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <FormField
                        control={control}
                        name={`schedules.${index}.scheduleName`}
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <Input placeholder="Schedule name *" {...field} className="rounded-full" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={control}
                        name={`schedules.${index}.date`}
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full pl-3 text-left font-normal h-11 rounded-full",
                                                    !field.value && "text-muted-foreground"
                                                )}
                                            >
                                                {field.value ? (
                                                    format(field.value, "PPP")
                                                ) : (
                                                    <span>Select date</span>
                                                )}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[320px] p-0 rounded-xl overflow-hidden shadow-lg border-0" align="start" sideOffset={8} collisionPadding={16}>
                                        <div className="p-4 bg-white">
                                            <Calendar
                                                mode="single"
                                                selected={field.value}
                                                onSelect={(date) => {
                                                    field.onChange(date);
                                                    setIsCalendarOpen(false); // Auto-close on select
                                                }}
                                                disabled={(date) =>
                                                    date < new Date(new Date().setHours(0, 0, 0, 0))
                                                }
                                                initialFocus
                                                // Enable Year Navigation
                                                fromYear={new Date().getFullYear()}
                                                toYear={new Date().getFullYear() + 2}
                                                captionLayout="dropdown"
                                                className="border rounded-md"
                                            />
                                        </div>
                                        {/* Footer removed for smoother UX (Auto-close) */}
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                {/* Section 2: Times */}
                <div className="grid grid-cols-3 gap-4">
                    <FormField
                        control={control}
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
                        control={control}
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
                        control={control}
                        name={`schedules.${index}.breakDuration`}
                        render={({ field }) => (
                            <FormItem>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="rounded-full">
                                            <SelectValue placeholder="Break time" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="0">Break time</SelectItem>
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
                    <h3 className="text-sm font-semibold">Positions</h3>

                    {fields.length > 0 && (
                        <div className="mb-4">
                            <PositionChips fields={fields} onRemove={remove} />
                        </div>
                    )}

                    <Button
                        type="button"
                        variant="outline"
                        className="w-full h-12 border-dashed border-2 text-zinc-500 bg-zinc-50/50 hover:bg-zinc-100 hover:border-zinc-400 hover:text-zinc-900"
                        onClick={() => setIsPositionDialogOpen(true)}
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
