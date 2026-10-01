"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@repo/ui/lib/utils";
import { NAV_ITEMS, isNavActive } from "./nav-items";
import { useRequestsWaiting, waitingLabel } from "./use-requests-waiting";

/**
 * The four places to go. One <nav> that CSS moves: pill tabs in the top bar on
 * a desktop, a tab bar fixed to the bottom of a phone where a thumb reaches it.
 * One element, so there is never a second, hidden copy to confuse a screen
 * reader (or a test) before the stylesheet has loaded.
 */
export function MainNav({ hasOrg }: { hasOrg: boolean }) {
    const pathname = usePathname();
    const waiting = useRequestsWaiting(hasOrg);

    return (
        <nav
            aria-label="Main"
            className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] md:static md:z-auto md:border-0 md:bg-transparent md:pb-0"
        >
            <ul className="mx-auto grid h-16 max-w-md grid-cols-4 md:flex md:h-auto md:max-w-none md:items-center md:gap-1">
                {NAV_ITEMS.map((item) => {
                    const active = isNavActive(item, pathname);
                    const Icon = item.icon;
                    return (
                        <li key={item.key} className="contents">
                            <Link
                                href={item.href}
                                aria-current={active ? "page" : undefined}
                                data-testid={`nav-link-${item.key}`}
                                className={cn(
                                    "flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                                    "md:h-10 md:flex-row md:gap-2 md:rounded-full md:px-3.5 md:text-sm lg:px-4",
                                    active
                                        ? "text-foreground md:bg-secondary md:text-secondary-foreground"
                                        : "text-muted-foreground md:hover:bg-muted md:hover:text-foreground",
                                )}
                            >
                                {/* The label comes first in the source so the link's name starts with it ("Schedule, 2 requests waiting"); `order` puts it where it looks right. */}
                                <span className="order-2 md:order-2">{item.label}</span>
                                <span
                                    className={cn(
                                        "relative order-1 grid h-8 w-14 place-items-center rounded-full transition-colors md:contents",
                                        active && "max-md:bg-secondary max-md:text-secondary-foreground",
                                    )}
                                >
                                    <Icon aria-hidden className="size-5 md:order-1 md:size-4" />
                                    {item.key === "schedule" && waiting > 0 ? (
                                        <span
                                            className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs font-semibold leading-none text-primary-foreground ring-2 ring-background md:static md:order-3 md:ring-0"
                                            aria-label={waitingLabel(waiting)}
                                        >
                                            {waiting}
                                        </span>
                                    ) : null}
                                </span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
