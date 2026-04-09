// apps/web/components/shifts/calendar-view.tsx

'use client';

import { useState, useMemo } from 'react';
import type { Shift } from '@/lib/types';
import { indexShiftsByDate } from '@/lib/shifts/data-access';
import { Button } from '@repo/ui/components/ui/button';
import {
    format,
    isToday,
    isSameMonth,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    addMonths,
    subMonths,
    parseISO,
    startOfWeek,
    endOfWeek,
} from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@repo/ui/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@repo/ui/components/ui/dialog';
import { ChevronLeft, ChevronRight, Loader2, Calendar } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { ShiftCard } from './shift-card';
import { getShiftRoleTone } from '@/lib/shifts/role-theme';

interface CalendarViewProps {
    shifts: Shift[];
    isLoading: boolean;
    onShiftClick?: (shift: Shift) => void;
}

export function CalendarView({ shifts, isLoading, onShiftClick }: CalendarViewProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    // Optimized: Create index once per shifts update. O(N)
    const shiftsByDate = useMemo(() => indexShiftsByDate(shifts), [shifts]);

    const days = useMemo(() => {
        return eachDayOfInterval({
            start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 }),
            end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 }),
        });
    }, [currentDate]);

    const handlePrev = () => setCurrentDate(prev => subMonths(prev, 1));
    const handleNext = () => setCurrentDate(prev => addMonths(prev, 1));

    const selectedShifts = useMemo(() => {
        if (!selectedDate) return [];
        return shiftsByDate.get(selectedDate) || [];
    }, [selectedDate, shiftsByDate]);

    if (isLoading) {
        return <div className="flex justify-center p-12 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    }

    return (
        <>
            <div className="overflow-hidden rounded-[28px] border border-border/70 bg-muted/30 shadow-sm">
                <div className="flex items-center justify-between px-6 py-5">
                    <h2 className="text-lg font-semibold text-foreground">
                        {format(currentDate, 'MMMM yyyy')}
                    </h2>
                    <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={handlePrev}><ChevronLeft className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={handleNext}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                </div>

                <div className="grid grid-cols-7 gap-3 px-4 pb-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="py-1">{d}</div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-3 px-4 pb-4">
                    {days.map((day) => {
                        const dateKey = format(day, 'yyyy-MM-dd');
                        const dayShifts = shiftsByDate.get(dateKey) || [];
                        const isCurrentMonth = isSameMonth(day, currentDate);
                        const isNow = isToday(day);

                        return (
                            <div
                                key={day.toISOString()}
                                onClick={() => setSelectedDate(dateKey)}
                                className={cn(
                                    "relative flex h-32 flex-col rounded-2xl border border-border/70 bg-card p-3 transition-transform hover:-translate-y-0.5 cursor-pointer",
                                    isCurrentMonth
                                        ? "text-foreground hover:shadow-sm"
                                        : "bg-card/60 text-muted-foreground hover:bg-card/80"
                                )}
                            >
                                <span className={cn(
                                    "text-sm font-semibold",
                                    isNow ? "text-primary" : isCurrentMonth ? "text-foreground" : "text-muted-foreground"
                                )}>
                                    {format(day, 'd')}
                                </span>

                                <div className="mt-2 flex flex-1 flex-col gap-1 overflow-y-auto">
                                    {dayShifts.length > 0 ? (
                                        <div className="flex flex-col gap-2">
                                            {dayShifts.slice(0, 2).map((shift) => {
                                                const tone = getShiftRoleTone(shift.title);

                                                return (
                                                    <TooltipProvider key={shift.id} delayDuration={0}>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div
                                                                    className={cn(
                                                                        "rounded-2xl border border-border/40 px-3 py-2.5 text-left",
                                                                        tone.surface,
                                                                    )}
                                                                >
                                                                    <p className="line-clamp-2 text-xs font-medium leading-4">
                                                                        {shift.title}
                                                                    </p>
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top" className="border-0 bg-secondary px-3 py-1.5 text-xs text-secondary-foreground">
                                                                <p className="font-semibold">{shift.title}</p>
                                                                <p className="opacity-80">{format(parseISO(shift.startTime), 'h:mm a')}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                );
                                            })}

                                            {dayShifts.length > 2 ? (
                                                <p className="text-[11px] font-medium text-muted-foreground">
                                                    +{dayShifts.length - 2} more
                                                </p>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <Dialog open={!!selectedDate} onOpenChange={(open) => !open && setSelectedDate(null)}>
                <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{selectedDate ? format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy') : 'Details'}</DialogTitle>
                        <DialogDescription>
                            {selectedShifts.length} shift{selectedShifts.length !== 1 ? 's' : ''} scheduled for this day.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-4 py-4">
                        {selectedShifts.length > 0 ? (
                            selectedShifts.map(shift => (
                                <ShiftCard key={shift.id} shifts={[shift]} onClick={onShiftClick} />
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                                <Calendar className="mb-3 h-10 w-10 text-muted-foreground/50" />
                                <p>No shifts scheduled for this day.</p>
                                <Button variant="outline" size="sm" className="mt-4">
                                    Schedule Shift
                                </Button>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
