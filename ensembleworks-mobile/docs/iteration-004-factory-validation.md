# Iteration 004 — Linux / Android factory verification

## Completion boundary

Factory credential-free scenarios and delivery of the
[owner checklist](iteration-004-owner-acceptance.md) are complete. **Iteration 004
is not complete:** all nine interactive/authenticated owner scenarios remain not
attempted. Iteration 003 iOS owner checks remain pending for the next Mac session.
No credentials were entered or requested; no backend or Access changes were made.

## Factory scenario map

| Seed scenario | Actual evidence |
| --- | --- |
| npm ci, test, check, Expo Doctor | Task-5 fresh Flox run: all exit 0; Node v24.21.0; 67 application + 18 component tests, seven Jest suites; TypeScript/version gate pass; Doctor 20/20 |
| Earlier tests/assertions preserved | Task 5 changes documentation only; task-4 test addition raised application count from 66 to 67; no test/assertion removal or weakening |
| Clean release with embedded bundle | Task-5 clean Android prebuild and release exit 0; Gradle 1m27s; inspected ARM64 artifact below |
| Production launch | Task-3 install/start pass, PID 2362 survives 20 seconds, empty crash buffer; [production result](evidence/android-launch/production-result.txt), [screenshot](evidence/android-launch/production.png) shows sign-in, no demo label |
| Demo launch | Task-3 install/start pass, PID 2219 survives 20 seconds, empty crash buffer; [demo result](evidence/android-launch/demo-result.txt), [screenshot](evidence/android-launch/demo.png) shows explicit test-adapter label |
| iOS preservation / shared changes | iOS scripts/configuration and Darwin environment preserved; shared Expo/RN dependency changes owner-authorized; no fresh Mac execution, historical iOS evidence is not a post-upgrade regression pass |
| Dependency justification | [Release ledger](android-release-build.md): original JNI header conflict fixed without upgrades; freshness-only patches and stable RN explicitly owner-authorized, not falsely justified by that conflict. WebRTC 150.1.0 trial failed R8; restored 144.2.0. [Launch diagnosis](android-emulator-launch.md) documents Android-only keep plugin instead |
| No secret exposure | Task-5 docs/diff, retained launch evidence and app logging reviewed; credential-free entry-point evidence only, no cookies, tokens, authenticated headers or token-bearing URLs retained; no authenticated AVD/traffic inspected |

Task-3 x86_64 launches remain applicable: task 4 changed tests/documentation only,
and task 5 changes documentation only. The extra ARM64 build does not replace or
claim execution of that emulator evidence. Both APK modes have their build-time
environment and checksums in [launch report](android-emulator-launch.md).

## Task-5 verification recipes and artifact

Commands from the app directory, no login shell:

```sh
flox activate -d .. -- node --version
flox activate -d .. -- timeout 360 npm ci
flox activate -d .. -- timeout 300 npm test
flox activate -d .. -- timeout 300 npm run check
flox activate -d .. -- timeout 300 npx expo-doctor
timeout --kill-after=30 2500 flox activate -d .. -- env \
  EXPO_PUBLIC_APP_MODE=production \
  EXPO_PUBLIC_DEPLOYMENT_URL=https://canvas-ew-lsp-001.ensembleworks.dev/ \
  EW_ANDROID_ARCHITECTURES=arm64-v8a \
  bash -c 'npx expo prebuild --clean --platform android && npm run build:android'
```

All exit 0. Full local logs: `/tmp/ew-task5-{ci,test,check,doctor,release,inspection}.log`.
CI reports 51 audit findings (26 moderate, 25 high) and deprecated transitive
packages; no audit remediation or dependency changes were attempted in task 5.
Existing Jest exclusions remain unchanged; no new gate suppression was added.

Copied generated `android/app/build/outputs/apk/release/app-release.apk` to
`~/.local/share/ensembleworks-mobile/artifacts/iteration-004/production-arm64-jni-release.apk`.
SHA-256: `11ed1f7990c28f72dc9b3dbba46049b18499f5b723e99e603c5dd1f3bbcfff42`.
Flox `unzip -l` confirms 18 libraries exclusively under `lib/arm64-v8a/`, including
WebRTC, React Native and Hermes; `assets/index.android.bundle` is 2,984,428 bytes.
Flox `$ANDROID_HOME/build-tools/37.0.0/apksigner verify --print-certs` exits 0,
Android Debug certificate SHA-256
`fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
Generated ProGuard lines 17–18 retain `livekit.org.webrtc.**` and
`livekit.org.jni_zero.**`: this artifact includes the task-3 startup fix missing
from task 2's retained APK. No generated native changes are committed.
Physical ARM64 execution is not claimed. See [exact sideload](device-handoff.md).

## Provisioning and limitations

[README setup](../README.md#android-on-the-owners-linux-host) records actual pins,
clean build and both emulator modes. The composed Nix SDK experiment stopped in
task 1: renderer initialization failed (`VK_ERROR_INCOMPATIBLE_DRIVER`, no GLES
context); a requested build component also could not install into the read-only
SDK. Task 2 used pinned Google sdkmanager packages in `~/Android/Sdk`, retaining
Flox Node/JDK 17, and proved KVM, NVIDIA host GPU/GLES and Logitech webcam
enumeration. See [experiment](android-toolchain-attempt.md),
[fallback build](android-release-build.md), and retained
[hardware evidence](evidence/android-launch/production-emulator.log).

Host microphone input/front webcam are configured, not proof of media capture.
PulseAudio reports `Could not init 'pa' audio driver`; actual audio and windowed
mode remain unverified. Only the owner can establish sign-in, HTTP/session reuse,
revocation and authenticated signaling/media; [source/tests](android-native-session-transport.md)
establish feasibility only, including cookie path/host caveats.
No emulator, simulator or Metro was started in task 5. Prior launch automation
stopped its emulators. Emulator evidence does not prove phone camera/mic/audio
routing, hardware encoding, background/lock, battery or another-network calls.
No concrete plan defect found; stale historical task notes are superseded by
the latest linked evidence, not silently converted into passes.
