const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { withUniwindConfig } = require("uniwind/metro");

// Expo SDK 54+ handles monorepo support automatically (including Bun).
// Sentry wrapper includes getDefaultConfig internally + sourcemap support.
const config = getSentryExpoConfig(__dirname);

module.exports = withUniwindConfig(config, {
    cssEntryFile: "./global.css",
    dtsFile: "./uniwind-env.d.ts",
});
