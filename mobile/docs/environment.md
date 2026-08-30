# Local environment setup

This covers what's needed to run `mobile/` locally. Full Android/iOS release
build docs land in Phase 10 (`android-local-build.md`, `ios-local-build.md`);
this file is the day-to-day dev setup.

## Prerequisites

- Node.js 20+ (developed against Node 24)
- Xcode + CocoaPods (iOS) — `xcode-select -p` should print an Xcode path,
  `pod --version` should work
- Android Studio + JDK 17 + Android SDK (Android) — see below for PATH setup
- Watchman (recommended, speeds up Metro file watching)

## Android SDK on `PATH`

A default Android Studio install puts the SDK at
`~/Library/Android/sdk` (macOS) but does **not** add `adb`/`emulator` to your
shell's `PATH`, and Gradle needs `ANDROID_HOME` set. Add to your shell
profile (`~/.zshrc` or equivalent):

```sh
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
```

Without this, `adb`, `emulator`, and Gradle's Android build all fail even
though the SDK is installed.

## First Android build: Gradle distribution download

`android/gradlew` downloads its pinned Gradle distribution from
`services.gradle.org` (which redirects to a GitHub release asset) the first
time it runs. In some sandboxed/proxied network environments, curl can reach
that URL fine while the JVM's own `HttpURLConnection` (which the Gradle
wrapper bootstrap uses) times out connecting — a JVM/proxy quirk, not a
project issue. If `./gradlew` fails with
`Downloading ... failed: timeout (10000ms)` while `curl` to the same URL
works, work around it once by pre-populating the wrapper's cache:

```sh
# Find the expected cache dir from the failed attempt:
find ~/.gradle/wrapper/dists -maxdepth 2
# Download straight into it with curl, matching gradle-wrapper.properties'
# distributionUrl filename exactly (e.g. gradle-9.3.1-bin.zip):
curl -L -o ~/.gradle/wrapper/dists/gradle-<version>-bin/<hash>/gradle-<version>-bin.zip \
  https://services.gradle.org/distributions/gradle-<version>-bin.zip
```

Subsequent builds and machines with normal outbound HTTPS won't need this.

## Local `android/local.properties`

Not committed (see `.gitignore`). Generated automatically by
`npx expo run:android` / `npx expo prebuild`, or create it manually:

```
sdk.dir=/Users/<you>/Library/Android/sdk
```

## Environment variables

Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to your backend
(the FastAPI server in `backend/`, typically `http://127.0.0.1:8000` for the
iOS Simulator; use your machine's LAN IP instead of `127.0.0.1` for a
physical device or the Android emulator, since neither can reach the host's
loopback address directly — see `docs/troubleshooting.md`, Phase 10).

Also set `EXPO_PUBLIC_WEB_URL` to the `frontend/` dev server (typically
`http://127.0.0.1:3000`). Some offer/outlet media fields come back as paths
relative to the website's own static hosting rather than absolute URLs — see
`src/utils/media.ts` — so this must point at wherever `frontend/` is actually
served for those images to load.

## Running

```sh
cd mobile
npm install
npx expo prebuild   # only needed after changing app.config.ts/native config
npx expo run:ios       # simulator, Debug configuration
npx expo run:android   # device/emulator, Debug configuration
npm run typecheck
npm run lint
npm test
```
