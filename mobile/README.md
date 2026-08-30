# Savvy Campus — Mobile

Native React Native (Expo, local-build) app for Android and iOS, sharing the
same FastAPI + MongoDB backend and user accounts as `../frontend`. Built
entirely on free/open-source Expo tooling — no EAS Build/Submit/Update, no
Expo cloud account required. See `../docs` (project-level) and this
directory's own `docs/` for the full breakdown.

## Status

This app is being built in phases (see the repo's mobile build plan). Each
phase's screens are real and functional as they land; screens not yet built
show a plain "coming in Phase N" placeholder rather than a fake control —
check `mobile/docs/architecture.md` (added once Phase 1 foundation docs are
complete) for current phase status.

## Quickstart

```sh
cd mobile
npm install
cp .env.example .env   # set EXPO_PUBLIC_API_URL to your local backend
npx expo run:ios       # requires Xcode + CocoaPods, see docs/environment.md
npx expo run:android   # requires Android Studio SDK, see docs/environment.md
```

## Scripts

| Command                           | Purpose                                                                                       |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| `npm start`                       | Start the Metro bundler                                                                       |
| `npm run ios` / `npm run android` | Start Metro + open in Expo Go-style dev client (use `npx expo run:*` for a real native build) |
| `npm run typecheck`               | `tsc --noEmit`, strict mode                                                                   |
| `npm run lint`                    | ESLint (`eslint-config-expo`)                                                                 |
| `npm test`                        | Jest (`jest-expo` preset)                                                                     |

## Structure

```
mobile/
├── app/            # Expo Router routes (file-based)
│   ├── _layout.tsx     # Root providers + stack
│   ├── (tabs)/          # Home, Explore, Card, Wallet, Profile
│   └── ...               # (auth)/, offers/, outlets/, verification/,
│                          #  coupons/, rewards/, settings/ land with their phases
├── src/
│   ├── api/          # Axios client, error normalization, query-key registry
│   ├── config/        # Runtime env validation (zod)
│   ├── design-system/  # Tokens + primitives (restrained dark theme)
│   ├── providers/       # QueryClient, network status
│   ├── services/         # Session/token storage, crash reporting seam
│   ├── storage/           # SecureStore wrapper — the ONLY place tokens are written
│   └── components/         # Shared components (error boundary, etc.)
├── android/ / ios/  # Generated via `expo prebuild` — see docs/environment.md
├── tests/           # Jest unit/component tests
├── e2e/             # Maestro flows (added in Phase 9)
└── docs/            # This app's own docs (env, auth, security, release, ...)
```

## Product identity

Currently placeholder values pending owner approval before any store
submission — see `mobile/docs/store-release.md` (added in Phase 10) and
`app.config.ts`:

|                 | Value                |
| --------------- | -------------------- |
| Name            | Savvy Campus         |
| Android package | `in.savvycampus.app` |
| iOS bundle id   | `in.savvycampus.app` |
| URL scheme      | `savvycampus`        |

Android package names and iOS bundle identifiers are effectively permanent
once published — do not change these casually.
