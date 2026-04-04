import { addDays, addMinutes, startOfWeek, subWeeks } from "date-fns";

import type { Location, Shift, TimesheetWorker } from "@/lib/types";

const MOCK_SHIFT_PREFIX = "mock-shift-";
const MOCK_WORKER_PREFIX = "mock-worker-";

type DashboardView = "upcoming" | "past" | "needs_approval" | "draft";

type MockWorker = {
    id: string;
    name: string;
    initials: string;
    avatarUrl?: string;
};

type MockLocation = Location;

interface DashboardMockBundle {
    upcomingShifts: Shift[];
    pastShifts: Shift[];
    pendingApprovalShifts: Shift[];
    draftShifts: Shift[];
    locations: MockLocation[];
    pendingCount: number;
    draftCount: number;
    timesheetsByShiftId: Record<string, TimesheetWorker[]>;
}

const MOCK_WORKERS: MockWorker[] = [
    { id: `${MOCK_WORKER_PREFIX}aisha`, name: "Aisha Patel", initials: "AP" },
    { id: `${MOCK_WORKER_PREFIX}marco`, name: "Marco Diaz", initials: "MD" },
    { id: `${MOCK_WORKER_PREFIX}priya`, name: "Priya Shah", initials: "PS" },
    { id: `${MOCK_WORKER_PREFIX}owen`, name: "Owen Carter", initials: "OC" },
    { id: `${MOCK_WORKER_PREFIX}nina`, name: "Nina Kim", initials: "NK" },
    { id: `${MOCK_WORKER_PREFIX}sage`, name: "Sage Thompson", initials: "ST" },
    { id: `${MOCK_WORKER_PREFIX}lena`, name: "Lena Brooks", initials: "LB" },
    { id: `${MOCK_WORKER_PREFIX}jules`, name: "Jules Rivera", initials: "JR" },
];

const MOCK_LOCATIONS: MockLocation[] = [
    {
        id: "mock-location-downtown",
        name: "Downtown Bistro",
        address: "201 Market Street, Boston, MA",
        timezone: "America/New_York",
    },
    {
        id: "mock-location-harbor",
        name: "Harbor Events Hall",
        address: "82 Seaport Ave, Boston, MA",
        timezone: "America/New_York",
    },
    {
        id: "mock-location-rooftop",
        name: "Rooftop Lounge",
        address: "19 Beacon Terrace, Boston, MA",
        timezone: "America/New_York",
    },
];

function getWorker(workerId: string) {
    const worker = MOCK_WORKERS.find((candidate) => candidate.id === workerId);

    if (!worker) {
        throw new Error(`Unknown mock worker: ${workerId}`);
    }

    return worker;
}

function createDate(base: Date, dayOffset: number, hours: number, minutes = 0) {
    const date = addDays(base, dayOffset);
    return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        hours,
        minutes,
        0,
        0,
    );
}

function createShift(options: {
    id: string;
    title: string;
    location: MockLocation;
    weekStart: Date;
    dayOffset: number;
    startHour: number;
    startMinute?: number;
    endHour: number;
    endMinute?: number;
    status: Shift["status"];
    assignedWorkerIds?: string[];
    capacityTotal: number;
    description?: string;
}) {
    const startTime = createDate(options.weekStart, options.dayOffset, options.startHour, options.startMinute ?? 0);
    const endTime = createDate(options.weekStart, options.dayOffset, options.endHour, options.endMinute ?? 0);
    const assignedWorkers = (options.assignedWorkerIds ?? []).map((workerId) => {
        const worker = getWorker(workerId);
        return {
            id: worker.id,
            name: worker.name,
            initials: worker.initials,
            avatarUrl: worker.avatarUrl,
        };
    });

    return {
        id: options.id,
        title: options.title,
        description: options.description,
        locationId: options.location.id,
        locationName: options.location.name,
        locationAddress: options.location.address,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        status: options.status,
        capacity: {
            filled: assignedWorkers.length,
            total: options.capacityTotal,
        },
        assignedWorkers,
    } satisfies Shift;
}

function createTimesheetEntry(
    shift: Shift,
    workerId: string,
    options?: {
        clockInOffsetMinutes?: number;
        clockOutOffsetMinutes?: number | null;
        breakMinutes?: number;
        status?: TimesheetWorker["status"];
    },
) {
    const worker = getWorker(workerId);
    const shiftStart = new Date(shift.startTime);
    const shiftEnd = new Date(shift.endTime);

    const clockIn = addMinutes(shiftStart, options?.clockInOffsetMinutes ?? 0).toISOString();
    const clockOut =
        typeof options?.clockOutOffsetMinutes === "number"
            ? addMinutes(shiftEnd, options.clockOutOffsetMinutes).toISOString()
            : undefined;

    return {
        id: worker.id,
        name: worker.name,
        avatarUrl: worker.avatarUrl,
        avatarInitials: worker.initials,
        role: shift.title,
        clockIn,
        clockOut,
        breakMinutes: options?.breakMinutes ?? 30,
        status: options?.status ?? "rostered",
    } satisfies TimesheetWorker;
}

export function isDashboardMockShiftId(shiftId: string) {
    return shiftId.startsWith(MOCK_SHIFT_PREFIX);
}

export function isDashboardMockModeEnabled(options?: {
    explicit?: boolean;
    hasLiveShifts?: boolean;
}) {
    const envValue = process.env.PAVN_DASHBOARD_MOCKS;
    const isDevelopment = process.env.NODE_ENV !== "production";

    if (options?.explicit && isDevelopment) {
        return true;
    }

    if (envValue === "1" || envValue === "true") {
        return true;
    }

    if (envValue === "0" || envValue === "false") {
        return false;
    }

    return isDevelopment && !options?.hasLiveShifts;
}

export function getDashboardMockBundle(now = new Date()): DashboardMockBundle {
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 0 });
    const previousWeekStart = subWeeks(currentWeekStart, 1);
    const nextWeekStart = addDays(currentWeekStart, 7);

    const downtown = MOCK_LOCATIONS[0]!;
    const harbor = MOCK_LOCATIONS[1]!;
    const rooftop = MOCK_LOCATIONS[2]!;

    const downtownOpenerSun = createShift({
        id: `${MOCK_SHIFT_PREFIX}downtown-opener-sun`,
        title: "Dining Room Opener",
        location: downtown,
        weekStart: currentWeekStart,
        dayOffset: 0,
        startHour: 7,
        endHour: 14,
        status: "assigned",
        assignedWorkerIds: [`${MOCK_WORKER_PREFIX}aisha`, `${MOCK_WORKER_PREFIX}marco`],
        capacityTotal: 3,
    });
    const downtownOpenerMon = createShift({
        id: `${MOCK_SHIFT_PREFIX}downtown-opener-mon`,
        title: "Dining Room Opener",
        location: downtown,
        weekStart: currentWeekStart,
        dayOffset: 1,
        startHour: 7,
        endHour: 14,
        status: "published",
        assignedWorkerIds: [`${MOCK_WORKER_PREFIX}aisha`],
        capacityTotal: 2,
    });
    const downtownOpenerTue = createShift({
        id: `${MOCK_SHIFT_PREFIX}downtown-opener-tue`,
        title: "Dining Room Opener",
        location: downtown,
        weekStart: currentWeekStart,
        dayOffset: 2,
        startHour: 7,
        endHour: 14,
        status: "published",
        assignedWorkerIds: [`${MOCK_WORKER_PREFIX}marco`, `${MOCK_WORKER_PREFIX}priya`],
        capacityTotal: 3,
    });
    const downtownHostWed = createShift({
        id: `${MOCK_SHIFT_PREFIX}downtown-host-wed`,
        title: "Host Stand",
        location: downtown,
        weekStart: currentWeekStart,
        dayOffset: 3,
        startHour: 12,
        endHour: 20,
        status: "published",
        assignedWorkerIds: [`${MOCK_WORKER_PREFIX}lena`],
        capacityTotal: 2,
    });
    const downtownHostFri = createShift({
        id: `${MOCK_SHIFT_PREFIX}downtown-host-fri`,
        title: "Host Stand",
        location: downtown,
        weekStart: currentWeekStart,
        dayOffset: 5,
        startHour: 12,
        endHour: 20,
        status: "assigned",
        assignedWorkerIds: [`${MOCK_WORKER_PREFIX}lena`, `${MOCK_WORKER_PREFIX}aisha`],
        capacityTotal: 2,
    });
    const harborCaptainWed = createShift({
        id: `${MOCK_SHIFT_PREFIX}harbor-captain-wed`,
        title: "Event Captain",
        location: harbor,
        weekStart: currentWeekStart,
        dayOffset: 3,
        startHour: 14,
        endHour: 22,
        status: "in-progress",
        assignedWorkerIds: [`${MOCK_WORKER_PREFIX}nina`, `${MOCK_WORKER_PREFIX}owen`],
        capacityTotal: 2,
    });
    const harborCaptainFri = createShift({
        id: `${MOCK_SHIFT_PREFIX}harbor-captain-fri`,
        title: "Event Captain",
        location: harbor,
        weekStart: currentWeekStart,
        dayOffset: 5,
        startHour: 14,
        endHour: 22,
        status: "assigned",
        assignedWorkerIds: [`${MOCK_WORKER_PREFIX}nina`, `${MOCK_WORKER_PREFIX}priya`],
        capacityTotal: 2,
    });
    const harborBartenderThu = createShift({
        id: `${MOCK_SHIFT_PREFIX}harbor-bartender-thu`,
        title: "Bartender",
        location: harbor,
        weekStart: currentWeekStart,
        dayOffset: 4,
        startHour: 15,
        endHour: 23,
        status: "published",
        assignedWorkerIds: [`${MOCK_WORKER_PREFIX}sage`],
        capacityTotal: 2,
    });
    const harborBartenderSat = createShift({
        id: `${MOCK_SHIFT_PREFIX}harbor-bartender-sat`,
        title: "Bartender",
        location: harbor,
        weekStart: currentWeekStart,
        dayOffset: 6,
        startHour: 15,
        endHour: 23,
        status: "open",
        assignedWorkerIds: [],
        capacityTotal: 2,
    });
    const rooftopExpoMon = createShift({
        id: `${MOCK_SHIFT_PREFIX}rooftop-expo-mon`,
        title: "Prep + Expo",
        location: rooftop,
        weekStart: currentWeekStart,
        dayOffset: 1,
        startHour: 9,
        endHour: 17,
        status: "assigned",
        assignedWorkerIds: [`${MOCK_WORKER_PREFIX}jules`],
        capacityTotal: 1,
    });
    const rooftopExpoTue = createShift({
        id: `${MOCK_SHIFT_PREFIX}rooftop-expo-tue`,
        title: "Prep + Expo",
        location: rooftop,
        weekStart: currentWeekStart,
        dayOffset: 2,
        startHour: 9,
        endHour: 17,
        status: "published",
        assignedWorkerIds: [],
        capacityTotal: 1,
    });
    const rooftopCloseThu = createShift({
        id: `${MOCK_SHIFT_PREFIX}rooftop-close-thu`,
        title: "Closing Lead",
        location: rooftop,
        weekStart: currentWeekStart,
        dayOffset: 4,
        startHour: 16,
        endHour: 23,
        status: "assigned",
        assignedWorkerIds: [`${MOCK_WORKER_PREFIX}jules`],
        capacityTotal: 1,
    });
    const rooftopCloseFri = createShift({
        id: `${MOCK_SHIFT_PREFIX}rooftop-close-fri`,
        title: "Closing Lead",
        location: rooftop,
        weekStart: currentWeekStart,
        dayOffset: 5,
        startHour: 16,
        endHour: 23,
        status: "published",
        assignedWorkerIds: [`${MOCK_WORKER_PREFIX}sage`],
        capacityTotal: 1,
    });
    const harborCaptainNextMon = createShift({
        id: `${MOCK_SHIFT_PREFIX}harbor-captain-next-mon`,
        title: "Event Captain",
        location: harbor,
        weekStart: nextWeekStart,
        dayOffset: 1,
        startHour: 14,
        endHour: 22,
        status: "assigned",
        assignedWorkerIds: [`${MOCK_WORKER_PREFIX}nina`, `${MOCK_WORKER_PREFIX}owen`],
        capacityTotal: 2,
    });
    const downtownOpenerNextTue = createShift({
        id: `${MOCK_SHIFT_PREFIX}downtown-opener-next-tue`,
        title: "Dining Room Opener",
        location: downtown,
        weekStart: nextWeekStart,
        dayOffset: 2,
        startHour: 7,
        endHour: 14,
        status: "published",
        assignedWorkerIds: [`${MOCK_WORKER_PREFIX}aisha`, `${MOCK_WORKER_PREFIX}marco`],
        capacityTotal: 3,
    });

    const upcomingShifts: Shift[] = [
        downtownOpenerSun,
        downtownOpenerMon,
        downtownOpenerTue,
        downtownHostWed,
        downtownHostFri,
        harborCaptainWed,
        harborCaptainFri,
        harborBartenderThu,
        harborBartenderSat,
        rooftopExpoMon,
        rooftopExpoTue,
        rooftopCloseThu,
        rooftopCloseFri,
        harborCaptainNextMon,
        downtownOpenerNextTue,
    ];

    const pastDowntownOpenerSun = createShift({
        id: `${MOCK_SHIFT_PREFIX}past-downtown-opener-sun`,
        title: "Dining Room Opener",
        location: downtown,
        weekStart: previousWeekStart,
        dayOffset: 0,
        startHour: 7,
        endHour: 14,
        status: "approved",
        assignedWorkerIds: [`${MOCK_WORKER_PREFIX}aisha`, `${MOCK_WORKER_PREFIX}marco`],
        capacityTotal: 2,
    });
    const pastHarborBartenderFri = createShift({
        id: `${MOCK_SHIFT_PREFIX}past-harbor-bartender-fri`,
        title: "Bartender",
        location: harbor,
        weekStart: previousWeekStart,
        dayOffset: 5,
        startHour: 16,
        endHour: 23,
        status: "approved",
        assignedWorkerIds: [`${MOCK_WORKER_PREFIX}sage`, `${MOCK_WORKER_PREFIX}priya`],
        capacityTotal: 2,
    });
    const pastRooftopCloseSat = createShift({
        id: `${MOCK_SHIFT_PREFIX}past-rooftop-close-sat`,
        title: "Closing Lead",
        location: rooftop,
        weekStart: previousWeekStart,
        dayOffset: 6,
        startHour: 16,
        endHour: 23,
        status: "cancelled",
        assignedWorkerIds: [`${MOCK_WORKER_PREFIX}jules`],
        capacityTotal: 1,
    });

    const pastShifts: Shift[] = [
        pastDowntownOpenerSun,
        pastHarborBartenderFri,
        pastRooftopCloseSat,
    ];

    const pendingApprovalShifts: Shift[] = [];
    const draftShifts: Shift[] = [];

    const timesheetsByShiftId: Record<string, TimesheetWorker[]> = {
        [`${MOCK_SHIFT_PREFIX}downtown-opener-sun`]: [
            createTimesheetEntry(downtownOpenerSun, `${MOCK_WORKER_PREFIX}aisha`, {
                clockInOffsetMinutes: 2,
                clockOutOffsetMinutes: -5,
                breakMinutes: 30,
            }),
            createTimesheetEntry(downtownOpenerSun, `${MOCK_WORKER_PREFIX}marco`, {
                clockInOffsetMinutes: 0,
                clockOutOffsetMinutes: 3,
                breakMinutes: 30,
            }),
        ],
        [`${MOCK_SHIFT_PREFIX}downtown-host-fri`]: [
            createTimesheetEntry(downtownHostFri, `${MOCK_WORKER_PREFIX}lena`, {
                clockInOffsetMinutes: 0,
                clockOutOffsetMinutes: -2,
                breakMinutes: 30,
            }),
            createTimesheetEntry(downtownHostFri, `${MOCK_WORKER_PREFIX}aisha`, {
                clockInOffsetMinutes: 6,
                clockOutOffsetMinutes: 0,
                breakMinutes: 15,
            }),
        ],
        [`${MOCK_SHIFT_PREFIX}harbor-captain-wed`]: [
            createTimesheetEntry(harborCaptainWed, `${MOCK_WORKER_PREFIX}nina`, {
                clockInOffsetMinutes: 0,
                clockOutOffsetMinutes: null,
                breakMinutes: 0,
            }),
            createTimesheetEntry(harborCaptainWed, `${MOCK_WORKER_PREFIX}owen`, {
                clockInOffsetMinutes: 4,
                clockOutOffsetMinutes: null,
                breakMinutes: 0,
            }),
        ],
        [`${MOCK_SHIFT_PREFIX}harbor-captain-fri`]: [
            createTimesheetEntry(harborCaptainFri, `${MOCK_WORKER_PREFIX}nina`, {
                clockInOffsetMinutes: 0,
                clockOutOffsetMinutes: 1,
                breakMinutes: 30,
            }),
            createTimesheetEntry(harborCaptainFri, `${MOCK_WORKER_PREFIX}priya`, {
                clockInOffsetMinutes: -3,
                clockOutOffsetMinutes: 4,
                breakMinutes: 30,
            }),
        ],
        [`${MOCK_SHIFT_PREFIX}rooftop-expo-mon`]: [
            createTimesheetEntry(rooftopExpoMon, `${MOCK_WORKER_PREFIX}jules`, {
                clockInOffsetMinutes: 0,
                clockOutOffsetMinutes: 0,
                breakMinutes: 30,
            }),
        ],
        [`${MOCK_SHIFT_PREFIX}rooftop-close-thu`]: [
            createTimesheetEntry(rooftopCloseThu, `${MOCK_WORKER_PREFIX}jules`, {
                clockInOffsetMinutes: 5,
                clockOutOffsetMinutes: 2,
                breakMinutes: 15,
            }),
        ],
        [`${MOCK_SHIFT_PREFIX}past-downtown-opener-sun`]: [
            createTimesheetEntry(pastDowntownOpenerSun, `${MOCK_WORKER_PREFIX}aisha`, {
                clockInOffsetMinutes: 0,
                clockOutOffsetMinutes: 0,
                breakMinutes: 30,
                status: "approved",
            }),
            createTimesheetEntry(pastDowntownOpenerSun, `${MOCK_WORKER_PREFIX}marco`, {
                clockInOffsetMinutes: 3,
                clockOutOffsetMinutes: -2,
                breakMinutes: 30,
                status: "approved",
            }),
        ],
        [`${MOCK_SHIFT_PREFIX}past-harbor-bartender-fri`]: [
            createTimesheetEntry(pastHarborBartenderFri, `${MOCK_WORKER_PREFIX}sage`, {
                clockInOffsetMinutes: -2,
                clockOutOffsetMinutes: 0,
                breakMinutes: 30,
                status: "approved",
            }),
            createTimesheetEntry(pastHarborBartenderFri, `${MOCK_WORKER_PREFIX}priya`, {
                clockInOffsetMinutes: 1,
                clockOutOffsetMinutes: 5,
                breakMinutes: 30,
                status: "approved",
            }),
        ],
    };

    return {
        upcomingShifts,
        pastShifts,
        pendingApprovalShifts,
        draftShifts,
        locations: MOCK_LOCATIONS,
        pendingCount: pendingApprovalShifts.length,
        draftCount: draftShifts.length,
        timesheetsByShiftId,
    };
}

export function getDashboardMockShifts(view: string, now = new Date()) {
    const bundle = getDashboardMockBundle(now);

    switch (view as DashboardView) {
        case "past":
            return bundle.pastShifts;
        case "needs_approval":
            return bundle.pendingApprovalShifts;
        case "draft":
            return bundle.draftShifts;
        case "upcoming":
        default:
            return bundle.upcomingShifts;
    }
}

export function getDashboardMockTimesheets(shiftId: string, now = new Date()) {
    const bundle = getDashboardMockBundle(now);
    return bundle.timesheetsByShiftId[shiftId] ?? [];
}
