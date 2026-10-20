# Android task-5 handoff

Documentation: `README.md` Android setup; `docs/iteration-004-factory-validation.md`
scenario map and artifact proof; `docs/iteration-004-owner-acceptance.md` nine
not-attempted owner checks; `docs/device-handoff.md` Pixel sideload and preserved
iOS history. Prior source trace: `docs/android-native-session-transport.md`;
tests: `tests/cloudflareAccess.test.ts`, `adapters.test.ts`,
`nativeAdapters.test.ts`, `accessSignIn.test.tsx`.

Use `flox activate -d .. --`, no login shell. Node v24.21.0; Linux JDK 17;
fallback SDK `~/Android/Sdk`. Exact pins in installer/README. Composed SDK failed
host GL/Vulkan and a read-only SDK component install; do not reopen experiment.
Owner freshness authorization recorded in `docs/android-release-build.md`.

Verified task 5: `timeout 360 npm ci`, `timeout 300 npm test` (67 application,
18 component tests), `timeout 300 npm run check`, `timeout 300 npx expo-doctor`
(20/20), all via Flox; logs `/tmp/ew-task5-*.log`. Clean ARM64 production build
recipe and checksum in factory report. Retained
`~/.local/share/ensembleworks-mobile/artifacts/iteration-004/production-arm64-jni-release.apk`
includes JNI keep rules, embedded bundle, verified debug signing. Older task-2
ARM64 APK lacks keep rules: do not use for Pixel. Generated native trees ignored.

Both task-3 x86_64 launches passed; screenshots re-inspected. No device/Metro
started task 5; adb list empty. Windowed/media/authentication unverified;
PulseAudio initialization failure remains. Never inspect authenticated AVDs;
after owner sign-in, factory needs a fresh credential-free AVD. Cookie
path/cross-host signaling caveats remain owner-only. Physical Pixel and next
Mac/iOS regression unexecuted. Iterations 003/004 owner checks remain pending.
