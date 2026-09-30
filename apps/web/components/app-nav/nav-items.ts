import { BarChart3, CalendarDays, ClipboardCheck, Users, type LucideIcon } from "lucide-react";
import { getDashboardShiftsHref, getSchedulerHref } from "@/lib/routes";

export type NavKey = "schedule" | "shifts" | "roster" | "reports";

export interface NavItem {
    key: NavKey;
    label: string;
    href: string;
    icon: LucideIcon;
    /** Path prefixes that light this item up. A worker profile belongs to Roster, a timesheet to Shifts. */
    match: string[];
}

/** One list for the desktop top bar and the phone tab bar, so they can't drift apart. */
export const NAV_ITEMS: NavItem[] = [
    { key: "schedule", label: "Schedule", href: getSchedulerHref(), icon: CalendarDays, match: ["/schedule"] },
    { key: "shifts", label: "Shifts", href: getDashboardShiftsHref(), icon: ClipboardCheck, match: ["/dashboard"] },
    { key: "roster", label: "Roster", href: "/rosters", icon: Users, match: ["/rosters", "/workers"] },
    { key: "reports", label: "Reports", href: "/reports", icon: BarChart3, match: ["/reports"] },
];

export function isNavActive(item: Pick<NavItem, "match">, pathname: string): boolean {
    return item.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
