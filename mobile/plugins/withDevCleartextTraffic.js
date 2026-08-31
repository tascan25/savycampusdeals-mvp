const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Local physical-device builds talk to FastAPI over the developer machine's
 * private-LAN HTTP address. This plugin is included only when APP_ENV is not
 * production; production builds keep Android's secure HTTPS-only default.
 */
module.exports = function withDevCleartextTraffic(config) {
  return withAndroidManifest(config, (nextConfig) => {
    const application = nextConfig.modResults.manifest.application?.[0];
    if (application) {
      application.$["android:usesCleartextTraffic"] = "true";
    }
    return nextConfig;
  });
};
