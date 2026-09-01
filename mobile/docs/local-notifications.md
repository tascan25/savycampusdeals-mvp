# Local notifications

Savvy schedules local reminders with `expo-notifications`; no backend, FCM
delivery, APNs delivery, or push token is involved when a reminder fires.

## Permission experience

- The app shows a branded pre-permission bottom sheet only for a signed-in user.
- It can appear at most once per rolling seven days while system permission is
  ungranted.
- `Allow notifications` opens the native system prompt when the OS still permits
  asking. After a denial it opens system settings instead.
- Granting permission prevents the sheet from appearing. `Not now` preserves the
  seven-day cooldown.

## Managed reminders

The app reconciles scheduled notifications after permission is granted, after a
coupon claim, on login, and whenever the app returns to the foreground.

- Student verification: 30 days, 7 days, 1 day, and expiry.
- Incomplete verification: 24 hours and 3 days after account creation. These
  are cancelled as soon as verification is submitted.
- Active partner coupons: halfway through the coupon lifetime, 24 hours, 1
  hour, and expiry.
- Active Savvy level rewards: 7 days and 1 day.

Users can also create up to 12 explicit reminders from **Saved offers**. Each
offer supports **Later today**, **Tomorrow**, and a native custom date/time
picker. Replacing a reminder cancels its previous OS request; unsaving the offer
or logging out cancels it as well.

Every reminder has a stable logical key. Its OS identifier is stored in
AsyncStorage so stale reminders can be cancelled after redemption, status/date
changes, account switching, logout, or account deletion. The nearest 48
automatic reminders plus at most 12 user-created reminders are retained to stay
below iOS's pending-notification limit.

Notification payloads contain routes and record identifiers only. They never
contain coupon codes, QR data, student numbers, verification images, access
tokens, or other sensitive data.

## Development testing

Use a development build for production-like native behavior. Open:

1. Profile.
2. Push notifications.
3. Enable notifications.
4. Use **Show test notification now** to verify foreground presentation.
5. Use **Schedule test in 10 seconds**, background the app, and verify the OS
   banner and Savvy icon.
6. Tap the notification and confirm it opens the expected app route.
7. Repeat while the app is terminated.
8. Use **Refresh scheduled reminders** and **Count managed reminders** to verify
   real coupon, reward, and verification schedules.
9. Redeem/expire a record or log out, then confirm stale reminders are removed.

Android uses the white-on-transparent Savvy `SC` notification glyph configured
at build time. iOS displays the installed Savvy app icon automatically. Native
icon changes require rebuilding the app.
