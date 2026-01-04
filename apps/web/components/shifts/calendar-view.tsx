// apps/web/components/shifts/calendar-view.tsx

'use client';

import { useState, useMemo } from 'react';
import type { Shift } from '@/lib/types';
import { indexShiftsByDate } from '@/lib/shifts/data-access';
import { Button } from '@repo/ui/components/ui/button';
import { format, isToday, isSameMonth, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, parseISO } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@repo/ui/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@repo/ui/components/ui/dialog';
import { ChevronLeft, ChevronRight, Loader2, Calendar } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { ShiftCard } from './shift-card';

interface CalendarViewProps {
    shifts: Shift[];
    isLoading: boolean;
}

export function CalendarView({ shifts, isLoading }: CalendarViewProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    // Optimized: Create index once per shifts update. O(N)
    const shiftsByDate = useMemo(() => indexShiftsByDate(shifts), [shifts]);

    const days = useMemo(() => {
        return eachDayOfInterval({
            start: startOfMonth(currentDate),
            end: endOfMonth(currentDate),
        });
    }, [currentDate]);

    const handlePrev = () => setCurrentDate(prev => subMonths(prev, 1));
    const handleNext = () => setCurrentDate(prev => addMonths(prev, 1));

    const selectedShifts = useMemo(() => {
        if (!selectedDate) return [];
        return shiftsByDate.get(selectedDate) || [];
    }, [selectedDate, shiftsByDate]);

    if (isLoading) {
        return <div className="p-12 text-center text-zinc-500 flex justify-center"><Loader2 className="animate-spin h-6 w-6" /></div>;
    }

    return (
        <>
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 shadow-sm">
                <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 bg-zinc-50">
                    <h2 className="text-lg font-semibold text-zinc-900">
                        {format(currentDate, 'MMMM yyyy')}
                    </h2>
                    <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={handlePrev}><ChevronLeft className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={handleNext}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                </div>

                <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-100 text-center text-xs font-semibold text-zinc-500">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="py-2">{d}</div>
                    ))}
                </div>

                <div className="grid grid-cols-7 divide-x divide-y divide-zinc-200 bg-zinc-200">
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
                                    "relative flex h-32 flex-col p-2 transition-colors hover:bg-zinc-100 cursor-pointer",
                                    isCurrentMonth ? "bg-zinc-50" : "bg-zinc-100/50 text-zinc-400"
                                )}
                            >
                                <span className={cn(
                                    "flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium",
                                    isNow ? "bg-zinc-900 text-white" : "text-zinc-700"
                                )}>
                                    {format(day, 'd')}
                                </span>

                                <div className="mt-2 flex-1 space-y-1 overflow-y-auto">
                                    {/* Dots */}
                                    {dayShifts.length > 0 && (
                                        <div className="flex flex-wrap content-start gap-1">
                                            {dayShifts.map(shift => (
                                                <TooltipProvider key={shift.id} delayDuration={0}>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className={cn(
                                                                "h-2 w-2 rounded-full",
                                                                shift.status === 'open' ? 'bg-role-host' :
                                                                    shift.status === 'cancelled' ? 'bg-destructive' : 'bg-muted-foreground'
                                                            )} />
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="bg-zinc-900 text-white border-0 text-xs py-1.5 px-3">
                                                            <p className="font-semibold">{shift.title}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            ))}
                                        </div>
                                    )}

                                    {dayShifts.length > 0 && (
                                        <p className="text-xs font-medium text-zinc-500 mt-2">
                                            {dayShifts.length} shift{dayShifts.length !== 1 ? 's' : ''}
                                        </p>
                                    )}
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

                    <div className="space-y-4 py-4">
                        {selectedShifts.length > 0 ? (
                            selectedShifts.map(shift => (
                                <ShiftCard key={shift.id} shifts={[shift]} />
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-center text-zinc-500">
                                <Calendar className="h-10 w-10 text-zinc-300 mb-3" />
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
