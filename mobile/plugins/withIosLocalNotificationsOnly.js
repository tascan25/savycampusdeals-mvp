const { withEntitlementsPlist } = require("expo/config-plugins");

/**
 * Keep expo-notifications available for local notifications on iOS without
 * enabling APNs. Expo's automatic notifications plugin adds aps-environment,
 * but Personal Apple development teams cannot provision that capability.
 */
module.exports = function withIosLocalNotificationsOnly(config) {
  return withEntitlementsPlist(config, (entitlementsConfig) => {
    delete entitlementsConfig.modResults["aps-environment"];
    return entitlementsConfig;
  });
};
