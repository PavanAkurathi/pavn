'use client'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY

// Skip init for the dev placeholder key — an invalid key makes posthog-js
// storm the network with failing /flags and /e requests (401/404 + CORS
// preflights) that stall the main thread.
const isRealKey = Boolean(POSTHOG_KEY) && !POSTHOG_KEY!.includes('mock')

if (typeof window !== 'undefined' && isRealKey) {
    posthog.init(POSTHOG_KEY!, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: false,
    })
}

export function CSPostHogProvider({ children }: { children: React.ReactNode }) {
    return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}
