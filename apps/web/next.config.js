/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        turbo: {
            resolveAlias: {
                "zod/v4": "zod",
            },
        },
    },
    webpack: (config) => {
        config.resolve.alias["zod/v4"] = "zod";
        return config;
    },
};

import { withSentryConfig } from "@sentry/nextjs";

export default withSentryConfig(nextConfig, {
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options

    org: "pavn",
    project: "pavn-web",

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
});
