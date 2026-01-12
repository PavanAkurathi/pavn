const { getDefaultConfig } = require("expo/metro-config");

// Expo SDK 54+ handles monorepo support automatically (including Bun).
// We rely on the default config now that dependencies are fixed.
const config = getDefaultConfig(__dirname);

config.resolver.unstable_enablePackageExports = true;

module.exports = config;
