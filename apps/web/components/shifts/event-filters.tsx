// apps/web/components/shifts/event-filters.tsx

'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { MapPin, Calendar as CalendarIcon, Filter, X, List, LayoutGrid } from "lucide-react";

import { Button } from '@repo/ui/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@repo/ui/components/ui/popover';
import { Calendar } from '@repo/ui/components/ui/calendar';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@repo/ui/components/ui/select';
import { SHIFT_STATUS, LOCATIONS, VIEW_MODES, STATUS_LABELS } from '@/lib/constants';

interface FilterState {
    location: string | null;
    status: string | null;
    view: string | null;
    startDate: string | null;
    endDate: string | null;
}

interface EventFiltersProps {
    filters: FilterState;
    setFilters: (updates: any) => void;
    availableLocations: string[];
}

export function EventFilters({ filters, setFilters, availableLocations }: EventFiltersProps) {

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
        (filters.startDate !== '' && filters.startDate !== null);

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
                        {availableLocations.map((loc) => (
                            <SelectItem key={loc} value={loc}>
                                <span className="truncate block max-w-[200px]" title={loc}>
                                    {(loc ?? '').split('–')[0]?.trim()}
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Date Range */}
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
                            endDate: null
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
                <button
                    onClick={() => setFilters({ view: VIEW_MODES.LIST })}
                    className={`flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition-all ${filters.view === VIEW_MODES.LIST
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    <List className="mr-2 h-4 w-4" />
                    List
                </button>
                <button
                    onClick={() => setFilters({ view: VIEW_MODES.CALENDAR })}
                    className={`flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition-all ${filters.view === VIEW_MODES.CALENDAR
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    <LayoutGrid className="mr-2 h-4 w-4" />
                    Calendar
                </button>
            </div>
        </div>
    );
}