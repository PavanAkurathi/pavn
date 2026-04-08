// apps/web/components/shifts/event-filters.tsx

'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Filter,
    LayoutGrid,
    List,
    MapPin,
    Calendar as CalendarIcon,
    X,
} from "lucide-react";

import { Button } from '@repo/ui/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@repo/ui/components/ui/popover';
import { Calendar } from '@repo/ui/components/ui/calendar';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@repo/ui/components/ui/select';
import { LOCATIONS, SHIFT_LAYOUTS, SHIFT_STATUS, STATUS_LABELS } from '@/lib/constants';
import { WorkerCombobox } from './worker-combobox';
import type { ShiftLayout } from '@/lib/types';

interface FilterState {
    location: string | null;
    status: string | null;
    startDate: string | null;
    endDate: string | null;
    workerId: string | null;
}

interface EventFiltersProps {
    filters: FilterState;
    setFilters: (updates: Partial<FilterState>) => void;
    layout: ShiftLayout;
    availableLayouts: ShiftLayout[];
    onLayoutChange: (layout: ShiftLayout) => void;
    weekRangeLabel: string;
    onPreviousWeek: () => void;
    onTodayWeek: () => void;
    onNextWeek: () => void;
    availableLocations: any[];
    availableWorkers: { id: string; name: string; initials: string }[];
}

export function EventFilters({
    filters,
    setFilters,
    layout,
    availableLayouts,
    onLayoutChange,
    weekRangeLabel,
    onPreviousWeek,
    onTodayWeek,
    onNextWeek,
    availableLocations,
    availableWorkers,
}: EventFiltersProps) {

    const dateRange: DateRange | undefined = React.useMemo(() => {
        if (!filters.startDate && !filters.endDate) return undefined;
        return {
            from: filters.startDate ? new Date(filters.startDate) : undefined,
            to: filters.endDate ? new Date(filters.endDate) : undefined,
        };
    }, [filters.startDate, filters.endDate]);

    const handleRangeChange = (range: DateRange | undefined) => {
        setFilters({
            startDate: range?.from ? range.from.toISOString() : null,
            endDate: range?.to ? range.to.toISOString() : null,
        });
    };

    const formattedDateLabel = React.useMemo(() => {
        if (!dateRange?.from) return 'Start/End Date';

        if (dateRange.to) {
            return `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d')}`;
        }
        return format(dateRange.from, 'MMM d, yyyy');
    }, [dateRange]);

    const hasActiveFilters =
        filters.location !== LOCATIONS.ALL ||
        filters.status !== SHIFT_STATUS.ALL ||
        filters.workerId !== null ||
        (filters.startDate !== '' && filters.startDate !== null);

    const layoutOptions = [
        { value: SHIFT_LAYOUTS.WEEKLY, label: 'Weekly', icon: LayoutGrid },
        { value: SHIFT_LAYOUTS.LIST, label: 'List', icon: List },
        { value: SHIFT_LAYOUTS.MONTH, label: 'Month', icon: CalendarDays },
    ].filter((option) => availableLayouts.includes(option.value));

    return (
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            {/* LEFT SIDE: DATA FILTERS */}
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">

                {/* Location Filter */}
                <Select
                    value={filters.location || LOCATIONS.ALL}
                    onValueChange={(val) => setFilters({ location: val })}
                >
                    <SelectTrigger className="w-[240px] bg-background border-border">
                        <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                        <SelectValue placeholder="All locations" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={LOCATIONS.ALL}>All Locations</SelectItem>
                        {availableLocations.map((loc: any) => {
                            const value = typeof loc === 'string' ? loc : loc.name;
                            const label = typeof loc === 'string' ? loc : loc.name;
                            return (
                                <SelectItem key={value} value={value}>
                                    <span className="truncate block max-w-[200px]" title={label}>
                                        {label}
                                    </span>
                                </SelectItem>
                            );
                        })}
                    </SelectContent>
                </Select>

                {/* Worker Search Combobox */}
                <WorkerCombobox
                    workers={availableWorkers}
                    value={filters.workerId}
                    onChange={(val) => setFilters({ workerId: val })}
                />

                {layout === SHIFT_LAYOUTS.WEEKLY ? (
                    <div className="flex items-center gap-2 rounded-xl border bg-background px-2 py-1.5">
                        <Button variant="ghost" size="icon" onClick={onPreviousWeek} aria-label="Previous week">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="min-w-[170px] px-1 text-center">
                            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Week</p>
                            <p className="text-sm font-semibold text-foreground">{weekRangeLabel}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={onTodayWeek}>
                            Today
                        </Button>
                        <Button variant="ghost" size="icon" onClick={onNextWeek} aria-label="Next week">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                ) : (
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className="w-[220px] justify-start bg-background border-border text-left font-normal"
                            >
                                <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                                {formattedDateLabel}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <div className="p-3">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={dateRange?.from}
                                    selected={dateRange}
                                    onSelect={handleRangeChange}
                                    numberOfMonths={2}
                                    pagedNavigation
                                    className="w-full"
                                />
                            </div>
                        </PopoverContent>
                    </Popover>
                )}

                {/* Status Filter */}
                <Select
                    value={filters.status || SHIFT_STATUS.ALL}
                    onValueChange={(val) => setFilters({ status: val })}
                >
                    <SelectTrigger className="w-[160px] bg-background border-border">
                        <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                        <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.values(SHIFT_STATUS).map((status) => (
                            <SelectItem key={status} value={status}>
                                {STATUS_LABELS[status] || status}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Reset */}
                {hasActiveFilters && (
                    <Button
                        variant="ghost"
                        onClick={() => setFilters({
                            location: LOCATIONS.ALL,
                            status: SHIFT_STATUS.ALL,
                            startDate: null,
                            endDate: null,
                            workerId: null
                        })}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                        <X className="mr-2 h-4 w-4" />
                        Reset
                    </Button>
                )}
            </div>

            {/* RIGHT SIDE: VIEW TOGGLES */}
            <div className="flex items-center rounded-full bg-muted/50 p-1">
                {layoutOptions.map((option) => {
                    const Icon = option.icon;
                    const isActive = layout === option.value;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => onLayoutChange(option.value)}
                            className={`flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition-all ${isActive
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <Icon className="mr-2 h-4 w-4" />
                            {option.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
