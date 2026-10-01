"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(max-width: 767px)"; // Tailwind's `md` is 768px

function subscribe(onChange: () => void) {
    const media = window.matchMedia(QUERY);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
}

/** True below the `md` breakpoint. False on the server, so sheets open from the side until the browser says otherwise. */
export function useIsPhone(): boolean {
    return useSyncExternalStore(
        subscribe,
        () => window.matchMedia(QUERY).matches,
        () => false,
    );
}
