"use client";

import { HistoryList } from "@/components/shifts/history-list";
import { Input } from "@repo/ui/components/ui/input";
import { Search } from "lucide-react";
import { Shift, ShiftStatus } from "@/lib/types";

// Mock Past Data
const MOCK_HISTORY_SHIFTS: Shift[] = [
    {
        id: "h1",
        title: "Event Server",
        locationId: "loc_1",
        locationName: "State Room",
        locationAddress: "60 State St",
        startTime: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString(), // Yesterday
        endTime: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString(),
        status: "completed" as ShiftStatus,
        capacity: { filled: 5, total: 5 },
        assignedWorkers: [
            { id: "w1", initials: "JD", avatarUrl: "https://github.com/shadcn.png" },
            { id: "w2", initials: "AB" },
            { id: "w3", initials: "CK" },
        ],
        price: 120
    },
    {
        id: "h2",
        title: "Bartender",
        locationId: "loc_1",
        locationName: "Boston Harbor Hotel",
        locationAddress: "Rowes Wharf",
        startTime: new Date(new Date().setDate(new Date().getDate() - 3)).toISOString(), // 3 days ago
        endTime: new Date(new Date().setDate(new Date().getDate() - 3)).toISOString(),
        status: "completed" as ShiftStatus,
        capacity: { filled: 4, total: 4 },
        assignedWorkers: [
            { id: "w4", initials: "MK" },
            { id: "w5", initials: "SL" }
        ],
        price: 150
    },
    {
        id: "h3",
        title: "Security Guard",
        locationId: "loc_2",
        locationName: "Fenway Park",
        locationAddress: "4 Jersey St",
        startTime: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString(), // 1 week ago
        endTime: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString(),
        status: "open" as ShiftStatus, // Was never filled
        capacity: { filled: 0, total: 2 },
        price: 180
    }
];

export default function HistoryPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Shift History</h2>
                    <p className="text-muted-foreground">
                        View and manage approved shift records.
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search history..."
                        className="pl-8 bg-white rounded-full w-full"
                    />
                </div>
            </div>

            <HistoryList
                shifts={MOCK_HISTORY_SHIFTS}
                isLoading={false}
                onShiftClick={(shift) => console.log("Clicked history shift", shift.id)}
            />
        </div>
    );
}
