# Android task-2 handoff

Task-2 gates and clean ARM64 release now pass. Owner replacement approval
permits stable RN 0.88.0 and five Expo patches; prerelease override removed.
Ledger and exact recipes: `docs/android-release-build.md`.
Parent completion is for the planner; launch scenarios remain task 3.

Sources: `scripts/build-android.sh`, `scripts/install-android-sdk.sh`,
`scripts/android-emulator.sh`; tests: `tests/*.test.ts` and Jest component suites.
Linux Flox selects `~/Android/Sdk`, Node v24.21.0, JDK 17.0.20.1+1.
Installer pins CLI 22.0, emulator 37.2.12, API37.1 ps16k Google APIs x86_64 r9
and revision-checks SDK packages. Composed SDK experiment is historical.
Darwin/iOS configuration/scripts unchanged; shared Expo/RN upgrades affect iOS.
iOS was not rebuilt on this Linux host.

Run each with `flox activate -d .. --`: `npm ci`, `npm test`,
`npm run check`, `npx expo-doctor`. Latest results: CI and 84 tests pass;
TypeScript and Check pass; Doctor passes 20/20.
Latest logs: `/tmp/ew-stable-*.log`.

Clean production recipe in report runs prebuild then `npm run build:android`
with public deployment URL and `EW_ANDROID_ARCHITECTURES=arm64-v8a`; latest passes.
Retained APK: `/home/stag/.local/share/ensembleworks-mobile/artifacts/iteration-004/production-arm64-release.apk`.
Report records updated checksum, 18 ARM64 libraries, bundle and debug certificate.
Generated native trees remain ignored. Build script clears host CPATH/include
paths to avoid JDK/NDK JNI ABI mismatch.

Earlier fallback KVM/NVIDIA boot/webcam enumeration passed; PulseAudio failed.
No emulator/Metro started this retry. Launch/screenshots remain task 3.
Owner authentication, audio, physical Pixel and iOS remain unverified.
Never inspect an authenticated owner AVD.
