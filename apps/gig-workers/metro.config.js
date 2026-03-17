const { getSentryExpoConfig } = require("@sentry/react-native/metro");

// Expo SDK 54+ handles monorepo support automatically (including Bun).
// Sentry wrapper includes getDefaultConfig internally + sourcemap support.
const config = getSentryExpoConfig(__dirname);

config.resolver.unstable_enablePackageExports = true;

module.exports = config;
