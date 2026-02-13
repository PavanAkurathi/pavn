"use client";

import { useState, useMemo } from "react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import useSWR from "swr";
import { DateRange } from "react-day-picker";
import { Download, Calendar as CalendarIcon, MapPin, Briefcase, User, Search } from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Popover, PopoverTrigger, PopoverContent } from "@repo/ui/components/ui/popover";
import { Calendar } from "@repo/ui/components/ui/calendar";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@repo/ui/components/ui/select";
import { Input } from "@repo/ui/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { Badge } from "@repo/ui/components/ui/badge";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { useOrganizationId } from "@/hooks/use-schedule-data";
import { API_BASE_URL } from "@/lib/constants";

const API_BASE = API_BASE_URL;

// Fetcher with auth
const fetcher = async (url: string, orgId: string) => {
    const res = await fetch(url, {
        headers: { 'x-org-id': orgId },
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
};

interface TimesheetRow {
    id: string;
    worker: { id: string; name: string; email: string; avatarUrl?: string; initials: string };
    shift: { id: string; title: string; date: string; scheduledStart: string; scheduledEnd: string };
    location: { id: string; name: string } | null;
    timesheet: {
        actualStart: string | null;
        actualEnd: string | null;
        breakMinutes: number;
        totalHours: number;
    };
    status: string;
}

interface ReportData {
    data: TimesheetRow[];
    summary: { totalWorkers: number; totalHours: number; };
    pagination: { hasMore: boolean };
}

interface FilterOptions {
    locations: { id: string; name: string }[];
    positions: string[];
}

export default function ReportsPage() {
    const orgId = useOrganizationId();

    // Date range state - default to current month
    const [dateRange, setDateRange] = useState<DateRange>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });

    // Filter state
    const [locationId, setLocationId] = useState<string>("all");
    const [position, setPosition] = useState<string>("all");
    const [search, setSearch] = useState<string>("");

    // Build query params
    const queryParams = useMemo(() => {
        if (!dateRange.from || !dateRange.to) return null;
        const params = new URLSearchParams({
            start: format(dateRange.from, 'yyyy-MM-dd'),
            end: format(dateRange.to, 'yyyy-MM-dd'),
        });
        if (locationId && locationId !== "all") params.set('locationId', locationId);
        if (position && position !== "all") params.set('position', position);
        if (search) params.set('search', search);
        return params.toString();
    }, [dateRange, locationId, position, search]);

    // Fetch filter options
    const { data: filterOptions } = useSWR<FilterOptions>(
        orgId && queryParams ? `${API_BASE}/timesheets/filters?${queryParams}` : null,
        (url: string) => fetcher(url, orgId!)
    );

    // Fetch timesheet data
    const { data: reportData, isLoading } = useSWR<ReportData>(
        orgId && queryParams ? `${API_BASE}/timesheets?${queryParams}` : null,
        (url: string) => fetcher(url, orgId!)
    );

    // Export handler
    const handleExport = () => {
        if (!queryParams) return;
        const exportUrl = `${API_BASE}/timesheets/export?${queryParams}&format=csv`;
        window.open(exportUrl, '_blank');
    };

    // Date label
    const dateLabel = useMemo(() => {
        if (!dateRange.from) return 'Select dates';
        if (dateRange.to) {
            return `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d, yyyy')}`;
        }
        return format(dateRange.from, 'MMM d, yyyy');
    }, [dateRange]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports</h1>
                    <p className="text-muted-foreground">Export timesheets for payroll</p>
                </div>
                <Button onClick={handleExport} className="gap-2" disabled={!reportData?.data.length}>
                    <Download className="h-4 w-4" />
                    Export CSV
                </Button>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-wrap gap-3">
                        {/* Date Range */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-[240px] justify-start">
                                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                                    {dateLabel}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="range"
                                    selected={dateRange}
                                    onSelect={(range) => range && setDateRange(range)}
                                    numberOfMonths={2}
                                />
                            </PopoverContent>
                        </Popover>

                        {/* Location */}
                        <Select value={locationId} onValueChange={setLocationId}>
                            <SelectTrigger className="w-[180px]">
                                <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                                <SelectValue placeholder="All Locations" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Locations</SelectItem>
                                {filterOptions?.locations.map(loc => (
                                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Position */}
                        <Select value={position} onValueChange={setPosition}>
                            <SelectTrigger className="w-[160px]">
                                <Briefcase className="mr-2 h-4 w-4 text-muted-foreground" />
                                <SelectValue placeholder="All Positions" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Positions</SelectItem>
                                {filterOptions?.positions.map(pos => (
                                    <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search worker..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 w-[200px]"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Data Table */}
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-b bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Worker</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Position</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Location</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Hours</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {isLoading ? (
                                    // Skeleton rows
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i}>
                                            <td className="px-4 py-3"><Skeleton className="h-8 w-32" /></td>
                                            <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                                            <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                                            <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                                            <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                                            <td className="px-4 py-3"><Skeleton className="h-5 w-16 mx-auto" /></td>
                                        </tr>
                                    ))
                                ) : reportData?.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                                            No timesheets found for the selected date range.
                                        </td>
                                    </tr>
                                ) : (
                                    reportData?.data.map(row => (
                                        <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarImage src={row.worker.avatarUrl} />
                                                        <AvatarFallback className="text-xs">{row.worker.initials}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="font-medium text-sm">{row.worker.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-muted-foreground">{row.shift.title}</td>
                                            <td className="px-4 py-3 text-sm text-muted-foreground">{row.location?.name || '—'}</td>
                                            <td className="px-4 py-3 text-sm">{format(new Date(row.shift.date), 'MMM d, yyyy')}</td>
                                            <td className="px-4 py-3 text-sm text-right font-medium">{row.timesheet.totalHours.toFixed(2)}h</td>
                                            <td className="px-4 py-3 text-center">
                                                <Badge variant={row.status === 'completed' ? 'default' : 'secondary'} className="capitalize">
                                                    {row.status}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Summary */}
            {reportData && (
                <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                    <span><strong className="text-foreground">{reportData.summary.totalWorkers}</strong> workers</span>
                    <span>•</span>
                    <span><strong className="text-foreground">{reportData.summary.totalHours.toFixed(1)}</strong> total hours</span>
                </div>
            )}
        </div>
    );
}
