# Savvy Campus

Student ID verification & discount platform. Verified college students
browse offers from partner outlets/brands and redeem QR-coded digital
coupons via a digital student card.

## Structure

```
SavyCampusDeals/
├── backend/    FastAPI + MongoDB API, shared by web and mobile
├── frontend/   React 19 website
├── mobile/     React Native (Expo, local-build) app for Android/iOS
└── docs/       Cross-cutting project docs
```

All three clients share one backend and one set of user accounts — a
website account works on mobile and vice versa.

## Mobile app

See [`mobile/README.md`](mobile/README.md) for the native Android/iOS app:
quickstart, local build setup, and structure. It's built entirely on
free/open-source Expo tooling (no EAS cloud services, no paid Expo account
required) with local Android Studio/Xcode builds — see
[`mobile/docs/environment.md`](mobile/docs/environment.md).
