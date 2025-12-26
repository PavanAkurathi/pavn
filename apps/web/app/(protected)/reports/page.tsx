"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { Badge } from "@repo/ui/components/ui/badge";
import { DollarSign, Users, Award, TrendingUp, TrendingDown, Clock } from "lucide-react";

// Mock Data
const FINANCIAL_DATA = {
    estimated: 12500,
    actual: 11200,
    variance: -10.4, // %
    currency: "USD"
};

const ATTENDANCE_DATA = {
    onTime: 85,
    late: 10,
    noShow: 5,
    totalShifts: 142
};

const TOP_PROS = [
    { id: "1", name: "Sarah Miller", role: "Event Server", rating: 5.0, shifts: 12, avatar: "https://github.com/shadcn.png", initials: "SM" },
    { id: "2", name: "James Wilson", role: "Bartender", rating: 4.9, shifts: 15, initials: "JW" },
    { id: "3", name: "Emily Chen", role: "Line Cook", rating: 4.8, shifts: 8, initials: "EC" },
    { id: "4", name: "Michael Brown", role: "Security", rating: 4.8, shifts: 20, initials: "MB" },
    { id: "5", name: "David Lee", role: "Event Server", rating: 4.7, shifts: 10, initials: "DL" },
];

export default function ReportsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports & Analytics</h1>
                <p className="text-muted-foreground">Performance summary for October 2025</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Financial Summary Card */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Labor Cost (Month)</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${FINANCIAL_DATA.actual.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Est: ${FINANCIAL_DATA.estimated.toLocaleString()}
                        </p>
                        <div className="mt-4 flex items-center text-xs">
                            {FINANCIAL_DATA.variance < 0 ? (
                                <span className="text-emerald-600 flex items-center font-medium">
                                    <TrendingDown className="mr-1 h-3 w-3" />
                                    {Math.abs(FINANCIAL_DATA.variance)}% under budget
                                </span>
                            ) : (
                                <span className="text-red-600 flex items-center font-medium">
                                    <TrendingUp className="mr-1 h-3 w-3" />
                                    {FINANCIAL_DATA.variance}% over budget
                                </span>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Attendance Summary Card */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{ATTENDANCE_DATA.onTime}%</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            On-time arrival rate
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                            <div className="flex flex-col bg-slate-50 p-2 rounded">
                                <span className="text-muted-foreground">Late</span>
                                <span className="font-semibold text-amber-600">{ATTENDANCE_DATA.late}%</span>
                            </div>
                            <div className="flex flex-col bg-slate-50 p-2 rounded">
                                <span className="text-muted-foreground">No Show</span>
                                <span className="font-semibold text-red-600">{ATTENDANCE_DATA.noShow}%</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Total Shifts / Active Pros (Third Metric?) Let's use Total Shifts for now to fill grid or keep it 2 cols? 
                    User asked for 3 key metrics. 
                    Let's use "Worker Satisfaction" or "Fill Rate"? 
                    Let's stick to Top Pros list as the 3rd visual component, but it takes more space.
                    Maybe make top pros a full width card below?
                */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Workers</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">42</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Deployed this month
                        </p>
                        <div className="mt-4 flex items-center text-xs text-emerald-600 font-medium">
                            <TrendingUp className="mr-1 h-3 w-3" />
                            +12% from last month
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Top Pros Section */}
            <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Top Performing Pros</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {TOP_PROS.map((pro) => (
                                <div key={pro.id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <Avatar className="h-9 w-9">
                                            <AvatarImage src={pro.avatar} alt={pro.name} />
                                            <AvatarFallback>{pro.initials}</AvatarFallback>
                                        </Avatar>
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium leading-none">{pro.name}</p>
                                            <p className="text-xs text-muted-foreground">{pro.role}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm">
                                        <div className="flex items-center text-amber-500 font-medium">
                                            <Award className="h-4 w-4 mr-1" />
                                            {pro.rating}
                                        </div>
                                        <div className="text-muted-foreground w-16 text-right">
                                            {pro.shifts} shifts
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
