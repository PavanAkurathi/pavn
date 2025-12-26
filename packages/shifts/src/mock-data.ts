import { addDays, subDays, startOfToday, setHours, addHours, startOfHour } from "date-fns";
import { Shift, ShiftStatus, TimesheetWorker } from "./types";

const TODAY = startOfToday();
const NOW = new Date();

// Helper to create dates relative to today
const getRelativeDate = (daysDiff: number, hour: number) => {
    const date = daysDiff >= 0 ? addDays(TODAY, daysDiff) : subDays(TODAY, Math.abs(daysDiff));
    return setHours(date, hour).toISOString();
};

export const MOCK_SHIFTS: Shift[] = [
    // 1. COMPLETED: ZOMBIE SHIFT (Pending Review)
    // Scenario: Ended yesterday, needs approval
    {
        id: "zombie-1",
        title: "Security Guard - Post Event",
        locationId: "loc_1",
        locationName: "Convention Center",
        locationAddress: "Main Lobby",
        startTime: getRelativeDate(-2, 14), // 2 Days Ago 2 PM
        endTime: getRelativeDate(-2, 22),   // 2 Days Ago 10 PM
        status: "completed" as ShiftStatus,
        capacity: { filled: 2, total: 2 },
        price: 180,
        assignedWorkers: [
            { id: "w1", name: "Adam Baker", initials: "AB", avatarUrl: "https://github.com/shadcn.png" },
            { id: "w2", name: "Charlie Davis", initials: "CD" }
        ]
    },

    // 2. COMPLETED: OVERTIME SCENARIO
    // Scenario: Ended yesterday, worker stayed late
    {
        id: "completed-ot",
        title: "Event Setup - Overtime",
        locationId: "loc_2",
        locationName: "Boston Harbor Hotel",
        locationAddress: "Ballroom B",
        startTime: getRelativeDate(-1, 8),  // Yesterday 8 AM
        endTime: getRelativeDate(-1, 16),   // Yesterday 4 PM
        status: "completed" as ShiftStatus,
        capacity: { filled: 1, total: 1 },
        price: 200,
        assignedWorkers: [
            { id: "w3", name: "Oliver Twist", initials: "OT" }
        ]
    },

    // 3. COMPLETED: LATE ARRIVAL
    // Scenario: Ended yesterday, worker arrived late
    {
        id: "completed-late",
        title: "Bartender - Late Start",
        locationId: "loc_3",
        locationName: "Fenway Park",
        locationAddress: "Royal Rooters",
        startTime: getRelativeDate(-1, 17), // Yesterday 5 PM
        endTime: getRelativeDate(-1, 23),   // Yesterday 11 PM
        status: "completed" as ShiftStatus,
        capacity: { filled: 1, total: 1 },
        price: 150,
        assignedWorkers: [
            { id: "w4", name: "Lara Anderson", initials: "LA" }
        ]
    },

    // 4. NEEDS APPROVAL: ORPHANED / FORGOTTEN CLOCK-OUT
    // Scenario: Assigned but ended 3 hours ago (Implicitly needs approval)
    {
        id: "orphaned-1",
        title: "Event Cleanup - Late",
        locationId: "loc_1",
        locationName: "Convention Center",
        locationAddress: "Hall B",
        startTime: addHours(NOW, -8).toISOString(), // Started 8 hours ago
        endTime: addHours(NOW, -3).toISOString(),   // Ended 3 hours ago (Only 1 hr overtime? No, ended 3 hours ago means it is >2h post-shift)
        status: "assigned" as ShiftStatus,
        capacity: { filled: 2, total: 2 },
        price: 180,
        assignedWorkers: [
            { id: "w13", name: "Forgot Frank", initials: "FF" },
            { id: "w14", name: "Clocked Clyde", initials: "CC" }
        ]
    },

    // 5. PAST: APPROVED (Historical)
    // Scenario: 2 days ago, already approved
    {
        id: "hist-approved",
        title: "Line Cook",
        locationId: "loc_3",
        locationName: "Fenway Park",
        locationAddress: "Main Kitchen",
        startTime: getRelativeDate(-2, 10), // 2 Days Ago 10 AM
        endTime: getRelativeDate(-2, 18),   // 2 Days Ago 6 PM
        status: "approved" as ShiftStatus,
        capacity: { filled: 3, total: 3 },
        price: 220,
        assignedWorkers: [
            { id: "w5", name: "Chris Kyle", initials: "CK" },
            { id: "w6", name: "Dave King", initials: "DK" },
            { id: "w7", name: "Eve K.", initials: "EK" }
        ]
    },

    // 6. PAST: CANCELLED
    // Scenario: 3 days ago, cancelled
    {
        id: "hist-cancelled",
        title: "Rainy Day Backup",
        locationId: "loc_3",
        locationName: "Fenway Park",
        locationAddress: "Gate A",
        startTime: getRelativeDate(-3, 12),
        endTime: getRelativeDate(-3, 16),
        status: "cancelled" as ShiftStatus,
        capacity: { filled: 0, total: 5 },
        price: 100
    },

    // 7. UPCOMING: HAPPENING NOW (In Progress)
    // Scenario: Started 2 hours ago, ends in 4 hours
    {
        id: "current-1",
        title: "Doorman - In Progress",
        locationId: "loc_2",
        locationName: "Boston Harbor Hotel",
        locationAddress: "Front Entrance",
        startTime: addHours(NOW, -2).toISOString(),
        endTime: addHours(NOW, 4).toISOString(),
        status: "assigned" as ShiftStatus,
        capacity: { filled: 1, total: 1 },
        price: 160,
        assignedWorkers: [
            { id: "w8", name: "Ian Paul", initials: "IP" }
        ]
    },

    // 8. UPCOMING: TOMORROW (Assigned)
    {
        id: "upcoming-1",
        title: "Wedding Server",
        locationId: "loc_1",
        locationName: "Convention Center",
        locationAddress: "Grand Ballroom",
        startTime: getRelativeDate(1, 15), // Tomorrow 3 PM
        endTime: getRelativeDate(1, 23),   // Tomorrow 11 PM
        status: "assigned" as ShiftStatus,
        capacity: { filled: 4, total: 5 },
        price: 140,
        assignedWorkers: [
            { id: "w9", name: "Will Smith", initials: "WS" },
            { id: "w10", name: "John Snow", initials: "JS" },
            { id: "w11", name: "Kevin Star", initials: "KS" },
            { id: "w12", name: "Laura Sun", initials: "LS" }
        ]
    },

    // 9. UPCOMING: FUTURE (Open)
    {
        id: "upcoming-2",
        title: "Dishwasher",
        locationId: "loc_3",
        locationName: "Fenway Park",
        locationAddress: "Kitchen B",
        startTime: getRelativeDate(2, 9), // 2 Days Future 9 AM
        endTime: getRelativeDate(2, 17),  // 2 Days Future 5 PM
        status: "open" as ShiftStatus,
        capacity: { filled: 0, total: 2 },
        price: 130
    }
];

// Timesheet Data for Detail Views (Mock DB)
// Timesheet Data for Detail Views (Mock DB)
export const MOCK_TIMESHEETS: Record<string, TimesheetWorker[]> = {
    "zombie-1": [
        {
            id: "w1", name: "Adam Baker", avatarInitials: "AB", role: "Security", hourlyRate: 20, breakMinutes: 30, status: "rostered",
            clockIn: getRelativeDate(-2, 14), clockOut: getRelativeDate(-2, 22) // Exact match to shift (-2 days)
        },
        {
            id: "w2", name: "Charlie Davis", avatarInitials: "CD", role: "Security", hourlyRate: 20, breakMinutes: 30, status: "rostered",
            clockIn: getRelativeDate(-2, 14), clockOut: getRelativeDate(-2, 22) // Exact match to shift (-2 days)
        }
    ],
    "completed-ot": [
        {
            id: "w3", name: "Oliver Twist", avatarInitials: "OT", role: "Setup", hourlyRate: 25, breakMinutes: 30, status: "rostered",
            clockIn: getRelativeDate(-1, 8), clockOut: getRelativeDate(-1, 18) // 2 Hours OVERTIME
        }
    ],
    "completed-late": [
        {
            id: "w4", name: "Lara Anderson", avatarInitials: "LA", role: "Bartender", hourlyRate: 18, breakMinutes: 30, status: "rostered",
            clockIn: getRelativeDate(-1, 18), clockOut: getRelativeDate(-1, 23) // 1 Hour LATE
        }
    ],
    "orphaned-1": [
        // Forgot Frank (w13) is MISSING here, so he will show as Empty/Needs fill
        {
            id: "w14", name: "Clocked Clyde", avatarInitials: "CC", role: "Cleanup", hourlyRate: 18, breakMinutes: 0, status: "rostered",
            clockIn: addHours(NOW, -8).toISOString(), clockOut: addHours(NOW, -3).toISOString()
        }
    ]
};

export const AVAILABLE_LOCATIONS = ["Downtown Cafe", "Westside Kitchen", "North End Bakery", "Boston Harbor Hotel", "Fenway Park", "State Room", "Convention Center"];
