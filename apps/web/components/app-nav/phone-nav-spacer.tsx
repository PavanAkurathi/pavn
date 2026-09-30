"use client";

import { usePathname } from "next/navigation";
import { isOnboardingPath } from "@/lib/routes";

/** Keeps the end of every page clear of the phone's fixed tab bar. Nothing from md up, and nothing during setup. */
export function PhoneNavSpacer() {
    const pathname = usePathname();
    if (isOnboardingPath(pathname)) return null;
    return <div aria-hidden className="h-[calc(4rem+env(safe-area-inset-bottom))] md:hidden" />;
}
