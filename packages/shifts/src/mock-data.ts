// packages/shifts/src/mock-data.ts

import { addDays, subDays, startOfToday, setHours, setMinutes } from "date-fns";
import { Shift, ShiftStatus, TimesheetWorker } from "./types";

const TODAY = startOfToday();

// Helper: Get Date relative to today
const getDate = (daysDiff: number, hour: number, minute: number = 0) => {
    const date = daysDiff >= 0 ? addDays(TODAY, daysDiff) : subDays(TODAY, Math.abs(daysDiff));
    return setMinutes(setHours(date, hour), minute).toISOString();
};

// ============================================================================
// 1. SHIFT DATA (The Cards)
// ============================================================================

export const MOCK_SHIFTS: Shift[] = [

    // ------------------------------------------------------------------
    // SCENARIO A: PENDING APPROVAL (Needs Manager Review)
    // Context: Shifts from Yesterday (Christmas) or Early This Morning
    // ------------------------------------------------------------------
    {
        id: "pending-01",
        title: "Holiday Security Detail",
        locationName: "Boston Harbor Hotel",
        locationAddress: "Lobby",
        startTime: getDate(-1, 8, 0), endTime: getDate(-1, 16, 0), // Yesterday 8am-4pm
        status: "completed",
        capacity: { filled: 2, total: 2 },
        price: 240, // Holiday rate
        assignedWorkers: [{ id: "w1", name: "Adam Baker", initials: "AB" }, { id: "w2", name: "Charlie Davis", initials: "CD" }]
    },
    {
        id: "pending-02",
        title: "Event Setup - Morning",
        locationName: "Convention Center",
        locationAddress: "Hall A",
        startTime: getDate(0, 5, 0), endTime: getDate(0, 10, 0), // Today 5am-10am (Just finished)
        status: "completed",
        capacity: { filled: 4, total: 4 },
        price: 150,
        assignedWorkers: [
            { id: "w3", name: "Evan Fisher", initials: "EF" }, { id: "w4", name: "Greg House", initials: "GH" },
            { id: "w5", name: "Iris West", initials: "IW" }, { id: "w6", name: "Jack Ryan", initials: "JR" }
        ]
    },
    {
        id: "pending-03",
        title: "Breakfast Buffet Server",
        locationName: "Omni Parker House",
        locationAddress: "Restaurant",
        startTime: getDate(0, 6, 0), endTime: getDate(0, 11, 0), // Today 6am-11am
        status: "completed",
        capacity: { filled: 1, total: 1 },
        price: 120,
        assignedWorkers: [{ id: "w7", name: "Kate Bishop", initials: "KB" }]
    },
    {
        id: "pending-04",
        title: "Valet Parking",
        locationName: "Seaport Hotel",
        locationAddress: "Driveway",
        startTime: getDate(-1, 16, 0), endTime: getDate(-1, 23, 59), // Yesterday Night
        status: "completed",
        capacity: { filled: 2, total: 2 },
        price: 180,
        assignedWorkers: [{ id: "w8", name: "Mike Ross", initials: "MR" }, { id: "w9", name: "Harvey S.", initials: "HS" }]
    },
    {
        id: "pending-05",
        title: "Dishwasher - Night Shift",
        locationName: "Fenway Park",
        locationAddress: "Kitchen",
        startTime: getDate(-1, 18, 0), endTime: getDate(-1, 23, 0),
        status: "completed",
        capacity: { filled: 1, total: 1 },
        price: 130,
        assignedWorkers: [{ id: "w10", name: "Oscar Martinez", initials: "OM" }]
    },
    {
        id: "pending-06",
        title: "Coat Check",
        locationName: "Symphony Hall",
        locationAddress: "Foyer",
        startTime: getDate(-1, 17, 0), endTime: getDate(-1, 21, 0),
        status: "completed",
        capacity: { filled: 2, total: 2 },
        price: 100,
        assignedWorkers: [{ id: "w11", name: "Pam Beesly", initials: "PB" }, { id: "w12", name: "Jim Halpert", initials: "JH" }]
    },
    {
        id: "pending-07",
        title: "Brand Ambassador",
        locationName: "Prudential Center",
        locationAddress: "Kiosk 4",
        startTime: getDate(-1, 10, 0), endTime: getDate(-1, 14, 0),
        status: "completed",
        capacity: { filled: 1, total: 1 },
        price: 140,
        assignedWorkers: [{ id: "w13", name: "Ryan Howard", initials: "RH" }]
    },
    {
        id: "pending-08",
        title: "Emergency Cleanup",
        locationName: "TD Garden",
        locationAddress: "Loading Dock",
        startTime: getDate(-1, 22, 0), endTime: getDate(0, 2, 0), // Overnight shift
        status: "completed",
        capacity: { filled: 3, total: 3 },
        price: 200,
        assignedWorkers: [{ id: "w14", name: "Stanley H.", initials: "SH" }, { id: "w15", name: "Toby F.", initials: "TF" }, { id: "w16", name: "Creed B.", initials: "CB" }]
    },

    // ------------------------------------------------------------------
    // SCENARIO B: IN PROGRESS (Happening Now)
    // Context: Current Time is Friday 10:58 AM.
    // These shifts started around 8am or 9am and end in the afternoon.
    // ------------------------------------------------------------------
    {
        id: "active-01",
        title: "Lunch Service Bartender",
        locationName: "Legal Sea Foods",
        locationAddress: "Main Bar",
        startTime: getDate(0, 10, 0), endTime: getDate(0, 15, 0), // Started 1 hour ago
        status: "in-progress",
        capacity: { filled: 1, total: 1 },
        price: 160,
        assignedWorkers: [{ id: "w17", name: "Angela Martin", initials: "AM" }]
    },
    {
        id: "active-02",
        title: "Concierge / Door",
        locationName: "Ritz Carlton",
        locationAddress: "Entrance",
        startTime: getDate(0, 7, 0), endTime: getDate(0, 15, 0), // Started 4 hours ago
        status: "in-progress",
        capacity: { filled: 1, total: 1 },
        price: 190,
        assignedWorkers: [{ id: "w18", name: "Dwight Schrute", initials: "DS" }]
    },
    {
        id: "active-03",
        title: "Conference Registration",
        locationName: "Hynes Convention Center",
        locationAddress: "Lobby B",
        startTime: getDate(0, 8, 30), endTime: getDate(0, 16, 30),
        status: "in-progress",
        capacity: { filled: 3, total: 3 },
        price: 175,
        assignedWorkers: [{ id: "w19", name: "Kelly Kapoor", initials: "KK" }, { id: "w20", name: "Phyllis Vance", initials: "PV" }, { id: "w21", name: "Meredith P.", initials: "MP" }]
    },
    {
        id: "active-04",
        title: "Line Cook - Prep",
        locationName: "Eataly",
        locationAddress: "Kitchen 2",
        startTime: getDate(0, 9, 0), endTime: getDate(0, 17, 0),
        status: "in-progress",
        capacity: { filled: 2, total: 2 },
        price: 180,
        assignedWorkers: [{ id: "w22", name: "Andy B.", initials: "AB" }, { id: "w23", name: "Erin H.", initials: "EH" }]
    },
    {
        id: "active-05",
        title: "Warehouse Sorter",
        locationName: "Amazon Hub",
        locationAddress: "Dock 5",
        startTime: getDate(0, 6, 0), endTime: getDate(0, 14, 0), // Ends soon
        status: "in-progress",
        capacity: { filled: 5, total: 5 },
        price: 150,
        assignedWorkers: [{ id: "w24", name: "Darryl P.", initials: "DP" }, { id: "w25", name: "Roy A.", initials: "RA" }, { id: "w26", name: "Val J.", initials: "VJ" }, { id: "w27", name: "Nate N.", initials: "NN" }, { id: "w28", name: "Hide T.", initials: "HT" }]
    },
    {
        id: "active-06",
        title: "Retail Associate",
        locationName: "Newbury Comics",
        locationAddress: "Floor 1",
        startTime: getDate(0, 10, 0), endTime: getDate(0, 18, 0),
        status: "in-progress",
        capacity: { filled: 1, total: 1 },
        price: 140,
        assignedWorkers: [{ id: "w29", name: "Jan Levinson", initials: "JL" }]
    },
    {
        id: "active-07",
        title: "IT Support Assistant",
        locationName: "Cambridge Innovation Center",
        locationAddress: "Tech Desk",
        startTime: getDate(0, 9, 0), endTime: getDate(0, 17, 0),
        status: "in-progress",
        capacity: { filled: 1, total: 1 },
        price: 220,
        assignedWorkers: [{ id: "w30", name: "Gabe Lewis", initials: "GL" }]
    },
    {
        id: "active-08",
        title: "Dog Walker (Bulk)",
        locationName: "Beacon Hill",
        locationAddress: "Park Entrance",
        startTime: getDate(0, 10, 30), endTime: getDate(0, 12, 30),
        status: "in-progress",
        capacity: { filled: 1, total: 1 },
        price: 60,
        assignedWorkers: [{ id: "w31", name: "David Wallace", initials: "DW" }]
    },

    // ------------------------------------------------------------------
    // SCENARIO C: UPCOMING (Future / Assigned)
    // Context: Tomorrow (Saturday) and Sunday
    // ------------------------------------------------------------------
    {
        id: "future-01",
        title: "Wedding Server - Grand Event",
        locationName: "Boston Public Library",
        locationAddress: "Courtyard",
        startTime: getDate(1, 15, 0), endTime: getDate(1, 23, 0), // Tomorrow 3pm
        status: "assigned",
        capacity: { filled: 4, total: 4 },
        price: 180,
        assignedWorkers: [
            { id: "w32", name: "Michael Scott", initials: "MS" }, { id: "w33", name: "Holly Flax", initials: "HF" },
            { id: "w34", name: "Karen F.", initials: "KF" }, { id: "w35", name: "Roy R.", initials: "RR" }
        ]
    },
    {
        id: "future-02",
        title: "Concert Security",
        locationName: "House of Blues",
        locationAddress: "Front Gate",
        startTime: getDate(1, 18, 0), endTime: getDate(1, 23, 59),
        status: "assigned",
        capacity: { filled: 3, total: 3 },
        price: 170,
        assignedWorkers: [{ id: "w36", name: "Hank Doyle", initials: "HD" }, { id: "w37", name: "Mose S.", initials: "MS" }, { id: "w38", name: "Rolf R.", initials: "RR" }]
    },
    {
        id: "future-03",
        title: "Brunch Host",
        locationName: "Friendly Toast",
        locationAddress: "Host Stand",
        startTime: getDate(2, 8, 0), endTime: getDate(2, 14, 0), // Sunday
        status: "assigned",
        capacity: { filled: 1, total: 1 },
        price: 130,
        assignedWorkers: [{ id: "w39", name: "Nellie B.", initials: "NB" }]
    },
    {
        id: "future-04",
        title: "Gallery Assistant",
        locationName: "ICA Boston",
        locationAddress: "Exhibit A",
        startTime: getDate(1, 11, 0), endTime: getDate(1, 17, 0),
        status: "assigned",
        capacity: { filled: 2, total: 2 },
        price: 150,
        assignedWorkers: [{ id: "w40", name: "Charles M.", initials: "CM" }, { id: "w41", name: "Jo Bennett", initials: "JB" }]
    },
    {
        id: "future-05",
        title: "Moving Helper",
        locationName: "Residential",
        locationAddress: "123 Main St",
        startTime: getDate(1, 9, 0), endTime: getDate(1, 13, 0),
        status: "assigned",
        capacity: { filled: 2, total: 2 },
        price: 200,
        assignedWorkers: [{ id: "w42", name: "Clark Green", initials: "CG" }, { id: "w43", name: "Pete Miller", initials: "PM" }]
    },
    {
        id: "future-06",
        title: "Stadium Usher",
        locationName: "Gillette Stadium",
        locationAddress: "Section 100",
        startTime: getDate(2, 12, 0), endTime: getDate(2, 18, 0),
        status: "assigned",
        capacity: { filled: 4, total: 4 },
        price: 140,
        assignedWorkers: [
            { id: "w44", name: "Robert C.", initials: "RC" }, { id: "w45", name: "Deangelo V.", initials: "DV" },
            { id: "w46", name: "Todd P.", initials: "TP" }, { id: "w47", name: "Cathy S.", initials: "CS" }
        ]
    },
    {
        id: "future-07",
        title: "Cloakroom Attendant",
        locationName: "Opera House",
        locationAddress: "Lobby",
        startTime: getDate(1, 18, 30), endTime: getDate(1, 22, 30),
        status: "assigned",
        capacity: { filled: 1, total: 1 },
        price: 110,
        assignedWorkers: [{ id: "w48", name: "Bob Vance", initials: "BV" }]
    },
    {
        id: "future-08",
        title: "Catering Chef",
        locationName: "Private Estate",
        locationAddress: "Kitchen",
        startTime: getDate(1, 14, 0), endTime: getDate(1, 22, 0),
        status: "assigned",
        capacity: { filled: 1, total: 1 },
        price: 300,
        assignedWorkers: [{ id: "w49", name: "Robert Cali", initials: "RC" }]
    }
];

// ============================================================================
// 2. TIMESHEET DATA (The Details)
// ============================================================================

export const MOCK_TIMESHEETS: Record<string, TimesheetWorker[]> = {};

// Helper to generate a "Perfect" timesheet entry
const createHappyEntry = (shift: Shift, worker: any, status: TimesheetWorker['status']): TimesheetWorker => {
    const isPending = status === 'submitted';
    return {
        id: worker.id,
        name: worker.name,
        avatarInitials: worker.initials,
        avatarUrl: `https://i.pravatar.cc/150?u=${worker.id}`,
        role: "Staff",
        hourlyRate: 20,
        breakMinutes: 30,
        status: status,
        // If submitted, use shift times. If rostered (in-progress), use start time but null end time.
        clockIn: isPending ? shift.startTime : shift.status === 'in-progress' ? shift.startTime : undefined,
        clockOut: isPending ? shift.endTime : undefined,
    };
};

// AUTO-GENERATE TIMESHEETS FOR THE MOCKS
// This ensures every ID in MOCK_SHIFTS has a corresponding entry in MOCK_TIMESHEETS
MOCK_SHIFTS.forEach(shift => {
    const statusMap: Record<string, TimesheetWorker['status']> = {
        'completed': 'submitted',
        'in-progress': 'rostered',
        'assigned': 'rostered',
        'approved': 'submitted',
        'cancelled': 'blocked',
        'open': 'rostered'
    };

    if (shift.assignedWorkers) {
        MOCK_TIMESHEETS[shift.id] = shift.assignedWorkers.map(worker =>
            createHappyEntry(shift, worker, statusMap[shift.status] || 'rostered')
        );
    }
});

export const AVAILABLE_LOCATIONS = ["Downtown Cafe", "Westside Kitchen", "North End Bakery", "Boston Harbor Hotel", "Fenway Park", "State Room", "Convention Center"];
