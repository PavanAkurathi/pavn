"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { BarChart3, Calendar, Inbox, ListChecks, Settings, Users, type LucideIcon } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { NavUser } from "@/components/nav-user";
import { NotificationsPopover } from "@/components/notifications/notifications-popover";
import { REQUESTS_SUMMARY_KEY, fetchRequestsSummary } from "@/lib/scheduler/client";
import {
    getDashboardShiftsHref,
    getRequestsHref,
    getSchedulerHref,
    isRosterPath,
    isSchedulerPath,
} from "@/lib/routes";
import type { TrialState } from "@/lib/trial";

type RailItem = {
    label: string;
    href: string;
    icon: LucideIcon;
    active: (pathname: string) => boolean;
    badge?: boolean;
};

const startsWith = (base: string) => (pathname: string) => pathname === base || pathname.startsWith(`${base}/`);

/** What a manager does every day. */
const PRIMARY: RailItem[] = [
    { label: "Schedule", href: getSchedulerHref(), icon: Calendar, active: isSchedulerPath },
    { label: "Team", href: "/rosters", icon: Users, active: isRosterPath },
    { label: "Requests", href: getRequestsHref(), icon: Inbox, active: startsWith("/requests"), badge: true },
];

/** Behind the divider: looked at less often. */
const SECONDARY: RailItem[] = [
    { label: "Shifts", href: getDashboardShiftsHref(), icon: ListChecks, active: startsWith("/dashboard") },
    { label: "Reports", href: "/reports", icon: BarChart3, active: startsWith("/reports") },
];

function RailLink({ item, waiting, pathname }: { item: RailItem; waiting: number; pathname: string }) {
    const on = item.active(pathname);
    const Icon = item.icon;
    return (
        <Link
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={cn(
                "relative flex w-[62px] flex-col items-center gap-1 rounded-[11px] pb-[7px] pt-2 text-[10px] font-semibold transition-colors",
                "max-md:w-11 max-md:py-1.5",
                on ? "bg-(--primary-soft) text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
        >
            <Icon aria-hidden className="size-[21px]" strokeWidth={2} />
            <span className="max-md:sr-only">{item.label}</span>
            {item.badge && waiting > 0 ? (
                <span
                    className="absolute right-3 top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-extrabold leading-none text-white max-md:right-0.5 max-md:top-0"
                    aria-label={`${waiting} ${waiting === 1 ? "request" : "requests"} waiting`}
                >
                    {waiting}
                </span>
            ) : null}
        </Link>
    );
}

/**
 * The icon rail down the left of the signed-in app (a bar across the top on a
 * phone): Schedule, Team and Requests, a divider, then Shifts and Reports, with
 * notifications, settings and the account menu at the bottom.
 */
export function AppRail({
    activeOrg,
    user,
    trial,
}: {
    activeOrg?: { id: string; name: string; logo?: string | null } | null;
    user?: { name?: string | null; email?: string | null; image?: string | null } | null;
    trial?: TrialState | null;
}) {
    const pathname = usePathname();
    // Requests waiting on a manager. Workers get a 403 and no badge.
    const { data: requests } = useSWR(activeOrg ? REQUESTS_SUMMARY_KEY : null, fetchRequestsSummary, {
        refreshInterval: 60_000,
        shouldRetryOnError: false,
    });
    const waiting = requests?.pending ?? 0;

    return (
        <aside
            className={cn(
                "z-40 flex shrink-0 items-center gap-1.5 border-b bg-card px-2 py-1.5",
                "md:sticky md:top-0 md:h-screen md:w-[78px] md:flex-col md:border-b-0 md:border-r md:px-0 md:py-3",
            )}
        >
            <Link
                href={getSchedulerHref()}
                title={activeOrg?.name}
                className="flex flex-col items-center gap-1 md:mb-2"
            >
                <span
                    aria-hidden
                    className="flex size-[34px] items-center justify-center overflow-hidden rounded-[11px] text-[17px] font-extrabold text-white"
                    style={{ background: "var(--brand-gradient)" }}
                >
                    {activeOrg?.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={activeOrg.logo} alt="" className="size-full object-cover" />
                    ) : (
                        "P"
                    )}
                </span>
                <span
                    data-testid="org-name"
                    className="line-clamp-2 w-[62px] break-words text-center text-[9.5px] font-semibold leading-tight text-muted-foreground max-md:sr-only"
                >
                    {activeOrg?.name || "Pavn"}
                </span>
            </Link>

            <nav aria-label="Main" className="flex flex-1 items-center gap-1.5 md:flex-col md:flex-none">
                {PRIMARY.map((item) => (
                    <RailLink key={item.href} item={item} waiting={waiting} pathname={pathname} />
                ))}
                <div aria-hidden className="mx-1 h-6 w-px bg-border md:mx-0 md:my-1.5 md:h-px md:w-8" />
                {SECONDARY.map((item) => (
                    <RailLink key={item.href} item={item} waiting={waiting} pathname={pathname} />
                ))}
            </nav>

            <div className="flex items-center gap-1.5 md:mt-auto md:flex-col">
                {trial ? (
                    <Link
                        href="/settings/billing"
                        title={`Free trial: ${trial.daysLeft} ${trial.daysLeft === 1 ? "day" : "days"} left`}
                        className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold",
                            trial.isExpiring ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground hover:text-foreground",
                        )}
                    >
                        Trial · {trial.daysLeft}d
                    </Link>
                ) : null}
                <div className="max-sm:hidden">
                    <NotificationsPopover side="right" align="end" />
                </div>
                <Link
                    href="/settings"
                    aria-label="Settings"
                    className={cn(
                        "flex size-9 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                        startsWith("/settings")(pathname) && "bg-(--primary-soft) text-primary",
                    )}
                >
                    <Settings aria-hidden className="size-5" />
                </Link>
                <NavUser user={user} compact />
            </div>
        </aside>
    );
}
