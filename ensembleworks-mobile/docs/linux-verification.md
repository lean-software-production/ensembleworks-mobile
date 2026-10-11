# Credential-free verification

Run from `ensembleworks-mobile/`. On the Mac use the repository-root flox
environment without a login shell:

```sh
flox activate -d .. -- npm ci
flox activate -d .. -- npm test
flox activate -d .. -- npm run check
flox activate -d .. -- npx expo-doctor
flox activate -d .. -- node --version
```

## Recorded result — 8 October 2026

The final factory run used Node `v24.21.0`. `npm ci`, `npm test`, `npm run check`,
and `npx expo-doctor` passed. The test run passed 66 application tests and 18
component tests across 7 suites; Expo Doctor passed all 20 checks. npm reported
71 transitive audit findings (25 moderate, 46 high); no forced or incompatible
dependency upgrade was made.

The tests cover the application and adapter decisions without credentials:

- Access native-confirmation sequencing, session reuse, expiry/cleanup, missing
  deployment configuration, and sign-in UI recovery;
- HTTP token parsing and treating Access redirects/login HTML as expiry;
- production session notification/retry behavior with no demo fallback;
- LiveKit adapter mappings, returned signaling URL use, native audio cleanup,
  track rendering, permission denial, and microphone-only joining when a camera
  is unavailable;
- demo identity/call behavior, visible demo labeling, and the absence of demo
  fallback in production.

The full command record and secret-exposure scan are in
[iteration 003 factory validation](iteration-003-factory-validation.md). The
unattended simulator build/launch record is in
[iOS 27 simulator verification](ios-27-simulator-verification.md).

## Boundaries

These tests and the demo mode do not authenticate with Cloudflare Access, prove
shared native cookies, retrieve a deployed token, connect to deployed LiveKit,
or establish real audio/video. The simulator has no camera. The owner must run
and record the [iteration 003 acceptance checklist](iteration-003-owner-acceptance.md).
For physical-iPhone prerequisites and remaining device checks, see the
[device handoff](device-handoff.md).
