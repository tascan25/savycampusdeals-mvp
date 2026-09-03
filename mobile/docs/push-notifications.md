# Android push notifications

Savvy uses `expo-notifications` to receive native notifications and the
Firebase Cloud Messaging HTTP v1 API to send them from FastAPI. Expo Push
Service and EAS Build are not required.

## Safety model

- Push is additive. Permission denial, token-registration failure, and FCM
  downtime never block login or the existing in-app announcement centre.
- Admin sends are saved as immutable campaigns after confirmation.
- MongoDB stores a durable delivery row per device, so retries and process
  restarts do not duplicate a successful send.
- FCM `accepted` is not described as delivery. The app separately records a
  user opening a notification.
- Notification payloads contain routing identifiers only. Never place student
  documents, access tokens, coupon codes, or other secrets in title/body/data.

## Firebase environments

Create separate Firebase projects and Android applications:

| Environment            | Recommended package          | Backend `PUSH_ENV` |
| ---------------------- | ---------------------------- | ------------------ |
| Development            | `in.savvycampus.app.dev`     | `development`      |
| Staging/internal test  | `in.savvycampus.app.staging` | `staging`          |
| Google Play production | `in.savvycampus.app`         | `production`       |

The production package identifier is permanent after Play publication and
must be owner-approved before creating the Play listing.

For each environment, download its `google-services.json` and keep it at a
local ignored path such as:

```text
mobile/firebase/google-services.development.json
mobile/firebase/google-services.production.json
```

Set the build-time path before running a native build:

```sh
GOOGLE_SERVICES_FILE=./firebase/google-services.development.json \
EXPO_PUBLIC_ANDROID_PACKAGE=in.savvycampus.app.dev \
npx expo run:android
```

Expo Go cannot receive remote push notifications on this Expo version. Use a
development build on an Android device or emulator with Google Play Services.

## Backend configuration

Create a dedicated Firebase service account with only the permissions needed
to send FCM messages. Keep the downloaded private JSON out of Git and mobile
builds. Configure the backend secret manager with:

```dotenv
PUSH_ENV=staging
PUSH_ENABLED=true
FCM_PROJECT_ID=savvy-campus-staging
FCM_SERVICE_ACCOUNT_JSON={the complete service account JSON as one secret value}
PUSH_WORKER_POLL_SECONDS=5
PUSH_MAX_ATTEMPTS=5
PUSH_TOKEN_STALE_DAYS=90
```

For local-only development, leave `PUSH_ENABLED=false`. Admins can compose and
preview drafts, but the backend refuses to queue a send. `FCM_SERVICE_ACCOUNT_FILE`
is also supported for a local ignored credential file; production should use
the hosting provider's encrypted secret storage.

## Transactional notifications

Backend-owned events are persisted as user-targeted transactional campaigns.
Each event has a deterministic `event_key`; the database's unique partial
index prevents retries or concurrent requests from creating duplicate pushes.
The existing worker fans the event out to every active installation belonging
to that user and tracks accepted, failed and opened counts per device.

Connected events:

- verification approved or rejected, including college-email auto-approval;
- Savvy level reward unlocked;
- coupon, level reward and Freshers café reward redeemed;
- password reset requested and password successfully changed.

Transactional pushes are additive. They are queued only when `PUSH_ENABLED`
is true, and a push persistence/provider failure never rolls back the business
event that already succeeded. Payloads include an event type, delivery ID and
safe in-app route only. Codes, QR values, reset tokens, student IDs and review
details are prohibited.

The mobile app updates `last_seen_at` whenever it registers its current token.
Permission revocation, logout, and token rotation delete the superseded live
registration. The worker also permanently removes registrations older than
`PUSH_TOKEN_STALE_DAYS`. If an uninstall cannot be observed beforehand, an FCM
`UNREGISTERED` response deletes the token immediately after that attempted send.
Delivery rows remain available for campaign auditing without retaining the live
device registration.

## Production release check

1. Confirm `in.savvycampus.app` and the final app name.
2. Create the production Firebase Android application with that exact package.
3. Configure the production `google-services.json` at build time.
4. Configure backend FCM credentials and `PUSH_ENV=production`.
5. Build a signed Android App Bundle and upload it to Play Internal Testing.
6. Install from Google Play; do not rely only on a debug APK.
7. Enable notifications from Profile → Push notifications.
8. Register a controlled internal-test audience before enabling broad sends.
9. Verify foreground, background, killed-app, logout, account switching,
   multiple devices, token rotation, scheduling, retries, and deep links.
10. Promote through closed testing only after the acceptance checklist passes.

## iOS boundary

Device registration and durable delivery rows retain `platform`, and every
business event is provider-neutral. `_send_push_delivery` is the single sender
boundary: it dispatches Android deliveries to FCM today and is where the APNs
sender will be added later. No verification/reward/redemption hook will need to
change.

The Android-only config plugin intentionally does not add Apple's
`aps-environment` entitlement, preserving free-account local iOS signing. For
iOS push delivery, add APNs credentials, a paid Apple Developer account, the
full Expo notifications iOS configuration, an APNs implementation at the
provider boundary, and then add `ios` to the enabled delivery platforms.
