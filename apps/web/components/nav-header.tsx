// apps/web/components/nav-header.tsx
"use client";

import { usePathname } from "next/navigation";
import { isOnboardingPath } from "@/lib/routes";
import { TopBar, type TopBarProps } from "./app-nav/top-bar";

/** The top bar of the signed-in app. The phone's tab bar is <BottomTabBar/>, rendered by the layout. */
export function NavHeader(props: TopBarProps) {
    const pathname = usePathname();

    // Distraction-free mode for setup
    if (isOnboardingPath(pathname)) return null;

    return <TopBar {...props} />;
}
