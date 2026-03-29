/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ["@repo/database", "@repo/auth", "@repo/billing", "@repo/email", "@repo/scheduling-timekeeping", "@repo/organizations", "@repo/gig-workers", "@repo/ui", "@repo/utils", "@repo/notifications", "@repo/observability"],
    // Next 16 uses Turbopack by default. Keep the config explicit so builds
    // don't fail on the presence of Sentry's webpack hooks.
    turbopack: {},
};

import { withSentryConfig } from "@sentry/nextjs";
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
