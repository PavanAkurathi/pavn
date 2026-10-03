"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isOnboardingPath } from "@/lib/routes";
import type { TrialState } from "@/lib/trial";
import { AppRail } from "./app-rail";

/**
 * The frame of the signed-in app: the icon rail and the page beside it, all in
 * the app skin (indigo, see packages/ui globals.css). Setup runs without the
 * rail so nothing pulls the owner away from it.
 */
export function AppShell({
    activeOrg,
    user,
    trial,
    children,
}: {
    activeOrg?: { id: string; name: string; logo?: string | null } | null;
    user?: { name?: string | null; email?: string | null; image?: string | null } | null;
    trial?: TrialState | null;
    children: ReactNode;
}) {
    const pathname = usePathname();

    if (isOnboardingPath(pathname)) {
        return (
            <div className="app-skin min-h-screen bg-background text-foreground">
                <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
            </div>
        );
    }

    return (
        <div className="app-skin flex min-h-screen flex-col bg-background text-foreground md:flex-row">
            <AppRail activeOrg={activeOrg} user={user} trial={trial} />
            <main className="min-w-0 flex-1 p-4 md:p-5">
                <div className="mx-auto w-full max-w-[1480px]">{children}</div>
            </main>
        </div>
    );
}
