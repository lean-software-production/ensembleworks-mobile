# Android task-1 handoff

Task 1 delivered the bounded composed-SDK experiment, not successful APK/boot
proof. `docs/android-toolchain-attempt.md` records commands, failures and the
explicit task-2 sdkmanager fallback decision. Do not extend the Flox SDK
experiment in later tasks. No application/dependency/iOS changes were made.

Sources: `../.flox/env/manifest.toml` and lock add Linux-only JDK 17.0.20.1+1;
`../.flox/pkgs/android-sdk.nix` pins SDK metadata/licenses/archives;
`scripts/android-emulator.sh` creates an isolated credential-free AVD.
Flox expression files must be Git-tracked (staged here). SDK output is explicitly
built by `flox activate -d .. -- flox build -d .. android-sdk`.

Owner daemon restart resolved activation; FloxHub warning is informational.
Do not repeat SDK experiments or sign in. `flox activate -d .. -- node --version` verifies v24.21.0.

Repair verification: `timeout --kill-after=10 60 flox activate -d .. -- node --version`
returns v24.21.0. `timeout --kill-after=10 180 flox activate -d .. -- npm test`
passes (66 application and 18 component tests); latest recovery output is in
`/tmp/ew-task1-current-test.log`. `timeout --kill-after=10 180 flox activate -d .. -- npm run check` fails
six Expo freshness expectations after TypeScript passes (full diagnostics:
`/tmp/ew-task1-current-check.log`). Preserve existing pins
unless an observed Android failure justifies upgrading.

Clean prebuild passed; release failed requesting absent build-tools 36.0.0 in
read-only SDK. KVM and Logitech webcam enumeration passed; GPU boot failed
Vulkan/GLES/framebuffer initialization. No APK or media proof.
Final expression adds 36.0.0 and corrects latest stable image to API 37.1
Google APIs ps16k x86_64 r8; these corrections are syntax-checked, not rebuilt.
Task 2 must close missing proofs with fallback. Emulator/ADB stopped; no Metro.
Mac/iOS checks remain pending. Native trees stay ignored.
