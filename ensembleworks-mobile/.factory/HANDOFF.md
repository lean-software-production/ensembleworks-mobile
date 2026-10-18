# Android task-4 handoff

Session transport source trace, scope caveats and exact verification recipes:
`docs/android-native-session-transport.md`. Authentication/token adapters:
`src/adapters/cloudflareAccess.ts`, `httpTokens.ts`; signaling boundary:
`liveKitRoom.ts`; UI: `src/components/AccessSignIn.tsx`, `App.tsx`.
Tests: `tests/cloudflareAccess.test.ts`, `adapters.test.ts`,
`nativeAdapters.test.ts`, `accessSignIn.test.tsx`.

Use `flox activate -d .. --` for commands. Node v24.21.0; Linux JDK 17,
fallback SDK in `~/Android/Sdk` (see `docs/android-release-build.md`).
Task-2 document records replacement owner authorization resolving freshness hold.
No task-4 dependency/native/runtime change: Android WebView already flushes
CookieManager, and RN HTTP/WebSocket use its forwarding handler.
WebSocket cookie lookup uses origin (not signaling path): path-restricted or
cross-host Access cookies remain owner-verification caveats, not proven defects.

Verified: `timeout 120 npx tsx --test tests/cloudflareAccess.test.ts tests/adapters.test.ts tests/nativeAdapters.test.ts`;
`timeout 300 npm test` (85 pass), `timeout 300 npm run check` (pass),
`timeout 300 npx expo-doctor` (20/20). Logs `/tmp/ew-task4-*.log`.
No services/devices started. Do not inspect authenticated AVDs or traffic.

Prior launch script/evidence: `scripts/verify-android-emulator-launch.sh`,
`docs/android-emulator-launch.md`. Both modes passed task 3; JNI keep plugin
preserves startup. Task-2 retained ARM64 APK lacks that fix: rebuild before
physical-device verification. PulseAudio initialization previously failed;
actual media/authentication/reuse/revocation remain owner-only. iOS unexecuted.
Task 5 documentation/checklist/Pixel handoff remains unfinished.
