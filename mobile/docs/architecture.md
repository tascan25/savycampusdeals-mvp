# Architecture

## Phase status

Built in phases against the approved plan (see repo root conversation /
plan history). Phase 1 (Foundation) is complete: routing shell, design
system, typed API client, SecureStore session storage stub, providers, error
boundary, native Android/iOS projects. Later phases fill in real screens and
the backend-integrated session/refresh flow — see each tab's placeholder
screen for which phase owns it.

## App shell

`app/_layout.tsx` is the single provider root:

```
GestureHandlerRootView
└── SafeAreaProvider
    └── ErrorBoundary            (src/components/ErrorBoundary.tsx)
        └── NetworkProvider       (src/providers/NetworkProvider.tsx)
            └── QueryProvider      (src/providers/QueryProvider.tsx — TanStack Query)
                └── Stack (Expo Router)
                    └── (tabs)      — Home, Explore, Card, Wallet, Profile
```

`(auth)` route group is reserved but empty until Phase 2 (Authentication)
adds real login/register/OTP screens — there is nothing to gate navigation
on yet since no login flow exists.

## API layer

- `src/api/client.ts` — single Axios instance, `baseURL =
EXPO_PUBLIC_API_URL + "/api"` (mirrors `frontend/src/lib/api.js`'s
  convention). Request interceptor attaches `X-Request-Id` (client-generated
  correlation id, not a security token) and `Authorization: Bearer` from the
  session store. Response interceptor normalizes errors via
  `src/api/errors.ts` and, on 401, ends the local session — full
  single-flight refresh-and-retry lands in Phase 2 once
  `POST /api/auth/mobile/refresh` exists on the backend.
- `src/api/errors.ts` — `ApiError` (extends `Error`) normalizes FastAPI's
  `detail` (string / validation-error list / object) into one `.message`,
  matching `frontend/src/lib/api.js`'s `formatApiError` so error copy is
  consistent across web and mobile.
- `src/api/queryKeys.ts` — central query-key registry. Every TanStack Query
  hook added in later phases derives its key from here, not an inline array
  literal, so cache invalidation across screens stays consistent.

## Session storage

- `src/storage/secureStore.ts` — the only module allowed to read/write
  tokens. Wraps `expo-secure-store` (iOS Keychain / Android Keystore).
  Never AsyncStorage.
- `src/services/session.ts` — read/write/clear the token pair, plus a small
  event bus (`onSessionExpired`) the API client and (later) navigation
  layer subscribe to. The single-flight refresh lock and the actual
  `/auth/mobile/refresh` call are Phase 2 work (that endpoint doesn't exist
  yet) — see `docs/authentication.md` once Phase 2 lands.

## Design system

`src/design-system/tokens.ts` + `components.tsx`. Same brand family as the
website's `design_guidelines.json` (indigo `#4F46E5` primary, `#050505`
ground) but deliberately restrained for native: no glassmorphism, no ambient
glow, minimal borders, 8-point spacing, 44pt minimum touch targets. Brand
recognition comes from type/color/shape/motion, not from repeating the logo
— the logo appears only on the app icon, splash screen, and optionally
during auth/onboarding (added in Phase 2), never in headers or on cards.

## Native projects

`android/` and `ios/` are generated via `npx expo prebuild` and are
git-ignored (regenerated, not hand-committed) until a phase needs native
code that prebuild can't express through `app.config.ts` plugins — at that
point they'll be tracked deliberately rather than regenerated. See
`docs/environment.md` for local build setup and a couple of real toolchain
quirks hit getting this running (Gradle wrapper download over this
environment's network, Android SDK `PATH`).
