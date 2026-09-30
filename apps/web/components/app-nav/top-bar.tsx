"use client";

import Link from "next/link";
import { cn } from "@repo/ui/lib/utils";
import { NotificationsPopover } from "../notifications/notifications-popover";
import { NavUser } from "../nav-user";
import { getDashboardShiftsHref } from "@/lib/routes";
import type { TrialState } from "@/lib/trial";
import { MainNav } from "./main-nav";
import { OrgMark } from "./org-mark";

export interface TopBarProps {
    activeOrg?: { id: string; name: string; logo?: string | null } | null;
    user?: { name?: string | null; email?: string | null; image?: string | null } | null;
    trial?: TrialState | null;
}

/**
 * The bar across the top. On a phone it shrinks to the business and the
 * account; the four places to go move to the tab bar at the bottom.
 */
export function TopBar({ activeOrg, user, trial }: TopBarProps) {
    return (
        <header className="sticky top-0 z-40 w-full border-b bg-background">
            <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 md:h-16 lg:px-8">
                <div className="flex min-w-0 items-center gap-2 lg:gap-6">
                    <Link
                        href={getDashboardShiftsHref()}
                        className="flex min-w-0 items-center gap-2.5 rounded-xl py-1 pr-2 transition-opacity hover:opacity-90"
                    >
                        <OrgMark name={activeOrg?.name} logo={activeOrg?.logo} />
                        <span
                            className="truncate text-[15px] font-semibold tracking-tight text-foreground"
                            data-testid="org-name"
                        >
                            {activeOrg?.name || "Workers Hive"}
                        </span>
                    </Link>

                    <MainNav hasOrg={Boolean(activeOrg)} />
                </div>

                <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
                    {trial ? (
                        <Link
                            href="/settings/billing"
                            className={cn(
                                "hidden items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors lg:inline-flex",
                                trial.isExpiring
                                    ? "bg-warn-soft text-warn hover:bg-warn-soft/70"
                                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                            )}
                        >
                            Trial · {trial.daysLeft} {trial.daysLeft === 1 ? "day" : "days"} left
                        </Link>
                    ) : null}
                    <NotificationsPopover />
                    <NavUser user={user} trial={trial} />
                </div>
            </div>
        </header>
    );
}
