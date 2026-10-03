# Iteration 001 Linux verification

Run from `ensembleworks-mobile/` with the locked dependencies (`npm ci`). No
credentials, running LiveKit server, device, or macOS are required:

```sh
npm test
npm run check
npx expo-doctor@1.20.4
npm ls --all
npm audit
```

Verified in the Codespace for this task: **50 application/adapter tests**, **8
component tests across 4 suites**, TypeScript, Expo dependency compatibility,
Expo Doctor **18/18**, and `npm ls --all` pass. Jest emits React Native's existing
SafeAreaView deprecation warning. `npm audit` is **not clean**: 57 transitive
findings (47 high, 10 moderate). No incompatible force-upgrades were applied;
see README's security caveat. Passing compatibility checks is not a security
or production readiness claim.

## Acceptance evidence

| Seed scenario / contract | Automated evidence |
| --- | --- |
| First launch, simulated sign-in, independent identity/name, logical `team`, permissions before immediate enabled join | `tests/joinApplication.test.ts` |
| Saved name, duplicate names with separate IDs, auto-subscription, relaunch/session reuse and expiry | `tests/joinApplication.test.ts`, `tests/callRecovery.test.ts` |
| Multiple teammates, self preview, names, camera-off placeholders, equal remote gain, participant updates | `tests/callApplication.test.ts`, `tests/callScreen.test.tsx` |
| Microphone/camera off and on; failed publication retains state | `tests/callApplication.test.ts`, `tests/callScreen.test.tsx` |
| Leave, disconnect, media/audio cleanup, event unsubscription, late-event isolation and rejoin | `tests/callApplication.test.ts`, `tests/callRecovery.test.ts`, `tests/nativeAdapters.test.ts` |
| Joining/empty-room, denied permissions, unavailable media, offline/connection failure, expiry and retry | `tests/callRecovery.test.ts`, `tests/appRecovery.test.tsx`, `tests/callScreen.test.tsx` |
| Actual HTTP response parsing: success, disabled, Access redirects/HTML, malformed JSON, network errors; demo rejected before transport | `tests/adapters.test.ts`, `tests/fixtures/tokenResponses.ts` |
| LiveKit SDK operation/event mappings, returned URL/token, volume, `disconnect(true)`, audio-session shutdown even after disconnect error | `tests/nativeAdapters.test.ts` |
| Native permission request mapping and serialized storage/error behavior | `tests/nativeAdapters.test.ts`, `tests/joinApplication.test.ts` |
| Real entry point explicitly selects demo; visible label persists through controls/rejoin; other values remain unresolved production | `tests/demoMode.test.tsx`, `tests/productionMode.test.tsx`, `tests/adapters.test.ts` |

The SDK-boundary double exercises `LiveKitRoomAdapter` itself, not a blanket
mock replacing application decisions. It models only SDK members used by that
adapter. `NativePermissionsAdapter` accepts WebRTC's permission-request boundary;
`PersistentIdentity` accepts AsyncStorage's key-value boundary. These adapters
are available for the future production composition but **are not installed in
the demo**. The production entry point intentionally has no connected room or
supported Cloudflare session transport.

## Exercise the demo

Use a rebuilt native development client, **not Expo Go** (Mac setup is in
README). Explicitly start Metro with:

```sh
EXPO_PUBLIC_APP_MODE=demo npm run start -- --tunnel
```

Confirm **TEST ADAPTER MODE — no real media or backend** remains visible. Simulate
sign-in, save a name, join, inspect Alex's simulated video and Sam's camera-off
tile alongside your self tile, toggle microphone/camera, leave and rejoin. Quit
and relaunch to reuse the AsyncStorage-backed name/ID. Denials, expiry, network
errors and participant changes are controlled deterministically in the tests,
not through hidden production fallbacks.

Stop Metro and restart without `EXPO_PUBLIC_APP_MODE` to see unresolved production
mode. Only the exact value `demo` selects doubles; there is no automatic fallback
when authentication or connection fails. Public Expo variables are build-time
configuration, not secrets; do not distribute a demo bundle as a production
calling app. Demo token retrieval is in memory, and the HTTP adapter additionally
rejects demo sessions before any request. No fake session is sent to the deployed
backend.

All video/audio here is a **modeled representation**. Linux results do not verify
native capture/playback, device permissions/storage, Cloudflare cookie sharing,
WebSocket authentication, actual backend room grants, or deployed compatibility.
Those remain iteration 002 work. The separate handoff task is not completed by
this verification report.
