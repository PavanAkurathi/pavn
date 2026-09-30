"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@repo/ui/lib/utils";
import { isOnboardingPath } from "@/lib/routes";
import { NAV_ITEMS, isNavActive } from "./nav-items";
import { useRequestsWaiting, waitingLabel } from "./use-requests-waiting";

const BAR_HEIGHT = "4rem";

/**
 * The four places to go, at the bottom of a phone where a thumb reaches them.
 * Hidden from md up, where the top bar carries the same items.
 */
export function BottomTabBar({ hasOrg = true }: { hasOrg?: boolean }) {
    const pathname = usePathname();
    const waiting = useRequestsWaiting(hasOrg);

    // Setup is distraction-free, same as the top bar.
    if (isOnboardingPath(pathname)) return null;

    return (
        <>
            {/* Keeps the end of every page clear of the fixed bar. */}
            <div
                aria-hidden
                className="md:hidden"
                style={{ height: `calc(${BAR_HEIGHT} + env(safe-area-inset-bottom))` }}
            />
            <nav
                aria-label="Main"
                className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 md:hidden"
                style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
                <ul className="mx-auto grid max-w-md grid-cols-4" style={{ height: BAR_HEIGHT }}>
                    {NAV_ITEMS.map((item) => {
                        const active = isNavActive(item, pathname);
                        const Icon = item.icon;
                        return (
                            <li key={item.key} className="contents">
                                <Link
                                    href={item.href}
                                    aria-current={active ? "page" : undefined}
                                    data-testid={`tab-${item.key}`}
                                    className="flex flex-col items-center justify-center gap-1 text-xs font-medium"
                                >
                                    <span
                                        className={cn(
                                            "relative grid h-8 w-14 place-items-center rounded-full transition-colors",
                                            active
                                                ? "bg-secondary text-secondary-foreground"
                                                : "text-muted-foreground",
                                        )}
                                    >
                                        <Icon aria-hidden className="size-5" />
                                        {item.key === "schedule" && waiting > 0 ? (
                                            <span
                                                className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-xs font-semibold leading-none text-primary-foreground ring-2 ring-background"
                                                aria-label={waitingLabel(waiting)}
                                            >
                                                {waiting}
                                            </span>
                                        ) : null}
                                    </span>
                                    <span className={active ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>
        </>
    );
}
