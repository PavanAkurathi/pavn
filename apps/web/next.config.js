import path from "node:path";
import { fileURLToPath } from "node:url";
import { withSentryConfig } from "@sentry/nextjs";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appDir, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ["@repo/database", "@repo/auth", "@repo/billing", "@repo/email", "@repo/scheduling-timekeeping", "@repo/organizations", "@repo/gig-workers", "@repo/ui", "@repo/notifications", "@repo/observability"],
    // Load `ws` (the Neon driver's WebSocket client) with Node's own require.
    // Bundled, its optional native `bufferutil` import became an empty stub,
    // so any frame of 48 bytes or more called an undefined `mask` and the
    // database connection died ("b.mask is not a function").
    serverExternalPackages: ["ws"],
    // Next 16 uses Turbopack by default. Keep the config explicit so builds
    // don't fail on the presence of Sentry's webpack hooks.
    turbopack: {
        root: repoRoot,
    },
    // The account menu sits at the bottom of the left rail, where the dev
    // indicator renders by default and swallows clicks on it (dev only).
    devIndicators: { position: "bottom-right" },
    // The old schedule builder became the Scheduler.
    async redirects() {
        return [{ source: "/dashboard/schedule/create", destination: "/schedule", permanent: false }];
    },
};

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

const sentryConfig = {
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options

    org: "pavn",
    project: "pavn-web",
    authToken: sentryAuthToken,

    // Only print logs for uploading source maps in CI
    silent: !process.env.CI,

    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Automatically annotate React components to show their full name in stack traces (increases bundle size)
    // moved to webpack.reactComponentAnnotation

    // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
    // This can increase your server load as well as your hosting bill.
    // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
    // side errors will fail.
    tunnelRoute: "/monitoring",

    // Hides source maps from generated client bundles
    hideSourceMaps: true,

    // Sentry Webpack Plugin Options
    webpack: {
        reactComponentAnnotation: {
            enabled: true,
        },
        treeshake: {
            removeDebugLogging: true,
        },
        automaticVercelMonitors: true,
    },
};

export default sentryAuthToken
    ? withSentryConfig(nextConfig, sentryConfig)
    : nextConfig;
