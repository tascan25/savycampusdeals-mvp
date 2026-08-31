/**
 * Configure expo-notifications for Android without adding the iOS
 * `aps-environment` entitlement. Savvy is shipping Android first, and adding
 * that entitlement now would make local iOS signing require a paid Apple
 * Developer push capability before the iOS notification phase begins.
 */
const {
  withNotificationsAndroid,
} = require("expo-notifications/plugin/build/withNotificationsAndroid");

module.exports = function withAndroidNotifications(config, props) {
  return withNotificationsAndroid(config, props ?? {});
};
