# Android task-3 handoff

Task 3 launch acceptance now passes. Sources: `scripts/verify-android-emulator-launch.sh`,
`scripts/android-emulator.sh`, `scripts/build-android.sh`, Android-only
`plugins/withLiveKitJniKeepRules.js` registered in `app.json`.
Tests: `tests/*.test.ts` and Jest component suites.
Evidence/recipes: `docs/android-emulator-launch.md`, `docs/evidence/android-launch/`.

Use `flox activate -d .. --` for commands. Linux uses Node v24.21.0,
JDK 17 and fallback SDK in `~/Android/Sdk`.
Run `timeout 3000 npm run verify:android-emulator-launch` (both modes), or
`env ANDROID_LAUNCH_MODE=demo npm run verify:android-emulator-launch`.
Verifier clean-builds x86_64 modes, owns port 5580, clears app state, and stops
its emulator. Never inspect an authenticated owner AVD.

WebRTC 144.2.0 startup SIGILL was a fatal JNI lookup trap: fresh main-buffer
jni_zero diagnostic reported missing `livekit/org/jni_zero/JniInit`.
Keep rules preserve WebRTC/JNI namespaces; minification remains enabled.
Published 150.1.0 previously failed R8; restored 144.2.0. No dependency diff.
Both final modes survive 20 seconds with empty crash buffers; screenshots inspected:
production sign-in without demo label, demo explicitly labeled test adapter.

Final `npm test`: 84 tests pass; `npm run check`, shell syntax and invalid-mode
checks pass. No emulators/Metro remain; ADB has no devices. KVM/GPU/webcam
enumeration pass; PulseAudio initialization still fails, actual media unverified.
iOS unchanged/unexecuted. Owner authentication/calls and Pixel execution pending.
Task-2 retained ARM64 APK is untouched and lacks this fix; rebuild before device
verification. Its location/build history is in `docs/android-release-build.md`.
