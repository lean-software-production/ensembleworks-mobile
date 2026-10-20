# Android composed-toolchain experiment — iteration 004, task 1

## Outcome and task-2 boundary

The credential-free Flox prerequisite is established. The composed SDK builds,
but **no APK or successful GPU-accelerated boot was produced**. Stop the Flox SDK
experiment here. Task 2 must replace SDK provisioning with the accepted pinned
Google `sdkmanager` script targeting `~/Android/Sdk`, retaining Flox Node/JDK,
and close the missing release-build, GPU boot and webcam proofs. No fallback
installer was implemented in task 1.

## Successful operator bootstrap (separate from interrupted attempts)

Operator-reported evidence: outside the factory, the operator's agent ran as
owner from the home directory at approximately 18:50 UTC:

```sh
nix profile add --extra-substituters https://cache.flox.dev --extra-trusted-public-keys 'flox-cache-public-1:7F4OyH7ZCnFhcze3fJdfyXYLQw/aV7GEed86nQ7IsOs=' 'github:flox/flox/latest'
```

It exited 0 in approximately three seconds. Earlier interrupted attempts had
already fetched most paths; Flox's binary cache avoided a source build. The
owner is a trusted Nix user. The resulting binary was
`/home/stag/.nix-profile/bin/flox`, version `1.18.2-g239bcea`. The key above is
the public binary-cache verification key, not a credential. This successful
installation was not rerun during the evidence repair.

Separately, the Nix daemon later hung with its single build slot
(`max-jobs = 1`) held by a stuck build. The owner restarted the daemon; the
slot freed once that build timed out. This was distinct from the successful
installation, not a Flox authentication requirement.

## Finding follow-up

- [x] Record the validator-requested exact successful operator install command,
  provenance, exit, duration and binary/version separately from interruptions.
- [x] Establish credential-free Flox activation and verify Node 24.21.0.
- [x] Deliver Linux JDK/SDK configuration and reproducible emulator script.
- [x] Attempt clean prebuild/release and scripted host-GPU/webcam boot; record
  exact failures and explicit fallback decision rather than claiming success.
- [ ] Carry actual APK/GPU boot proof to task 2 under the accepted fallback.
- [ ] `npm run check` reports dependency-freshness incompatibilities; retain
  current pins until an Android module failure justifies changing them.

Earlier bootstrap/activation timeouts were not authentication failures. The
operator reported a hung Nix daemon and stale single build slot, then restarted
the daemon. Subsequent activation returned Node 24.21.0. Flox's
“not logged in to FloxHub” message is informational; no sign-in was attempted.
An independently inspected Flox source (`warn_if_logged_out`) also identifies
it as a warning, not a local-environment activation gate.

## Durable configuration

Repository-root `../.flox/env/manifest.toml` adds `jdk17@17.0.20.1+1` for
`x86_64-linux` only. Its Linux-only activation hook exports `JAVA_HOME` from
Flox's resolved `javac`, and `ANDROID_HOME`/`ANDROID_SDK_ROOT` from the
repository-root `result-android-sdk/libexec/android-sdk`. This result is created
explicitly by `flox build`, not automatically by activation. Missing SDK output
does not block first activation/build. Darwin package pins and iOS app/scripts
are unchanged; Flox regenerated duplicate `out` entries in Node output lists
without changing their paths/versions. No Mac execution is claimed.

`../.flox/pkgs/android-sdk.nix` pins nixpkgs revision
`151fa4e8ddfdd8dd25d945ad94ed54a13de9f6e4` and its unpacked SHA-256. Its
`repo.json` pins archive hashes. Initial build/boot evidence below used Google APIs x86_64
API **37.0 revision 6**. Final metadata review found latest stable **37.1**
(no codename, SDK license); its Google APIs x86_64 image is the 16-KiB-page
variant, **revision 8**, not the plain `google_apis` directory. The final
expression/script now select `37.1/google_apis_ps16k/x86_64`; these corrected
pins are syntax-checked only, not built/booted after the fallback decision.
Task 2 must use this latest image and supply the API 37 compile platform too.
Component pins:

| Component | Version |
| --- | --- |
| SDK legacy tools / command-line tools | 26.1.1 / 22.0 |
| platform-tools | 37.0.1 |
| platform | final: 37.1 revision 1; attempted: 37.0 revision 2 |
| build-tools | 37.0.0; additionally 36.0.0 after observed build request |
| NDK | 27.1.12297006 |
| CMake | 3.22.1 |
| emulator | 37.1.11 (stable; 37.2.4 uses preview license) |

The expression accepts the Android SDK license, not blanket unfree software:
its predicate admits only Android SDK derivations and explicitly named upstream
archives. Initial evaluation failures exposed additional archive-level unfree
checks; the predicate was corrected before the successful SDK build. The final
36.0.0 and latest-image corrections were syntax-checked but **not rebuilt** after the GPU failure
triggered the stop boundary. The existing successful output therefore contains
37.0.0 only.

`scripts/android-emulator.sh` creates isolated AVD
`ensembleworks-api37-1-factory` under `~/.android/ensembleworks-factory-avd`, using
the `pixel_9` hardware profile. It idempotently sets host GPU, front `webcam0`,
no back camera, audio input/output, 4 GiB RAM and 6 GiB data. It requires KVM and
`/dev/video0`, forces `-accel on -gpu host`, disables snapshots and metrics, and
never selects software rendering. The attempted AVD was the prior
`ensembleworks-api37-factory` (API 37.0); latest-image creation remains unrun.
Default runtime bound is 1800 seconds,
overridable with `EW_EMULATOR_SECONDS`; exit 124 means the bound expired.
Run from this app directory:

```sh
flox activate -d .. -- bash scripts/android-emulator.sh headless
flox activate -d .. -- bash scripts/android-emulator.sh windowed
```

Windowed mode is provided but was not executed. The AVD is credential-free;
do not reuse it for owner sign-in checks or read an owner's authenticated AVD.

## Commands and observed results (this Linux host)

All commands below ran from the app directory. Local full diagnostics remain
in `/tmp/ew-task1-*.log`; this document retains only secret-free observations.
`flox --version` reports `1.18.2-g239bcea`; system Nix is 2.35.3.

| Command | Exit / observation |
| --- | --- |
| `timeout --kill-after=10 180 flox activate -d .. -- node --version` | 0, `v24.21.0`, after earlier 60/300-second activation timeouts |
| `timeout --kill-after=15 900 flox activate -d .. -- node --version` | 0 after Linux JDK manifest addition |
| `timeout 300 flox activate -d .. -- npm ci` | 0 |
| `timeout --kill-after=15 1800 flox activate -d .. -- flox build -d .. android-sdk` | 0 after evaluation fixes; repository-root `result-android-sdk` points to `/nix/store/84b3hdc3amgpnqkbs8dgfpxii37vs4vj-androidsdk` |
| `flox activate -d .. -- java -version` | 0, OpenJDK 17.0.20.1+1-nixos |
| `flox activate -d .. -- emulator -version` | 0, 37.1.11.0 build 15917651 |
| `timeout 30 flox activate -d .. -- emulator -accel-check` | 0, `KVM (version 12) is installed and usable.` |
| `timeout 30 flox activate -d .. -- emulator -webcam-list` | 0, Logitech Webcam C930e, `webcam0`, YUYV |
| `timeout 30 flox activate -d .. -- avdmanager list device` | 0, includes `pixel_9` |
| `flox activate -d .. -- bash -n scripts/android-emulator.sh` | 0 after final script edit |
| `flox activate -d .. -- bash scripts/android-emulator.sh invalid` | 2, expected usage rejection |
| `flox activate -d .. -- nix-instantiate --parse ../.flox/pkgs/android-sdk.nix` | 0 after final expression edit |
| `timeout --kill-after=10 180 flox activate -d .. -- npm test` | 0: 66 application tests and 18 component tests, 7 Jest suites |
| `timeout --kill-after=10 180 flox activate -d .. -- npm run check` | 1: TypeScript passes; Expo dependency freshness check fails (below) |

### Clean prebuild and embedded-release attempt

```sh
timeout --kill-after=15 1800 flox activate -d .. -- env \
  EXPO_PUBLIC_APP_MODE=production \
  EXPO_PUBLIC_DEPLOYMENT_URL=https://canvas-ew-lsp-001.ensembleworks.dev/ \
  bash -c 'npx expo prebuild --clean --platform android && cd android && ./gradlew --no-daemon :app:assembleRelease -PreactNativeArchitectures=x86_64'
```

Exit 1 (`/tmp/ew-task1-release.log`). Clean Android prebuild succeeds and
`package.json` is unchanged. Gradle 9.4.1 reaches project configuration, then:

```text
Could not determine the dependencies of task ':expo:compileReleaseJavaWithJavac'.
Failed to install the following SDK components:
    build-tools;36.0.0 Android SDK Build-Tools 36
The SDK directory is not writable (.../result-android-sdk/libexec/android-sdk)
```

The expression now includes that explicitly requested component; do not let
Gradle download into the store. No native-module compile/link incompatibility
has yet been demonstrated and no dependency was upgraded. No APK exists to
report; bundle/debug-keystore signing remains unverified. Generated `android/`
is ignored and is not a deliverable.

### Scripted boot attempt

`timeout --kill-after=15 270 flox activate -d .. -- bash /tmp/ew-task1-boot.sh`
returned 1. This temporary harness set `EW_EMULATOR_SECONDS=240`, started
`bash scripts/android-emulator.sh headless`, polled
`adb -s emulator-5580 shell getprop sys.boot_completed` every two seconds for
110 attempts, and killed the AVD on exit. Boot never reached `1`.
`/tmp/ew-task1-emulator.log` records KVM and webcam enumeration above, followed by:

```text
Graphics backend: gfxstream
emuglConfig_init: vulkan_mode_selected:host gles_mode_selected:host
Failed to create Vulkan instance. Error VK_ERROR_INCOMPATIBLE_DRIVER.
Failed to find exactly 1 GLES 2.x config: found 0.
Failed to validate creating GLES 2.x context.
Failed to initialize GL emulation.
Could not initialize emulated framebuffer
Could not start renderer! (Error: -2)
```

AVD creation also warns about the NDK `ndk-bundle` alias location and absent
image `devices.xml`, but proceeds to renderer initialization. Configured GPU
flags and webcam enumeration do not establish rendered boot or camera frames.
No software renderer was substituted. Audio input remains configured, not
verified. This is the concrete host-GPU failure that triggers task-2 fallback.
The final script additionally disables metrics and selects the corrected
latest stable image; no second boot was attempted.

### Evidence-repair verification

No SDK build, prebuild or emulator experiment was repeated for this repair.
Fresh host checks used the prescribed non-login Flox invocation:

| Command | Exit / observation |
| --- | --- |
| `timeout --kill-after=10 60 flox activate -d .. -- node --version` | 0, `v24.21.0` |
| `timeout --kill-after=10 180 flox activate -d .. -- npm test` | 0; full output inspected at `/tmp/ew-task1-recovery-test.log` |
| `timeout --kill-after=10 180 flox activate -d .. -- npm run check` | 1; TypeScript passes, same six Expo freshness mismatches below; full diagnostics inspected at `/tmp/ew-task1-recovery-check.log` |

These checks do not close the missing APK/GPU boot proof. No code or test was
changed in this evidence-only repair.

### Current recovery verification

The next recovery attempt inspected the committed report, emulator script and
outstanding repository-root manifest/lock/expression changes; it preserved them.
No SDK experiment, native generation, code/test edit or dependency change was
made. Fresh checks on this host:

| Command | Exit / observation |
| --- | --- |
| `timeout --kill-after=10 60 flox activate -d .. -- node --version` | 0, `v24.21.0` |
| `timeout --kill-after=10 180 flox activate -d .. -- npm test` | 0, 66 application tests plus 18 component tests in 7 suites |
| `timeout --kill-after=10 180 flox activate -d .. -- npm run check` | 1, TypeScript passes; same six dependency mismatches listed below |
| `flox activate -d .. -- git diff --check` | 0 |

Full test and failure output was inspected in
`/tmp/ew-task1-current-test.log` and `/tmp/ew-task1-current-check.log`.
These results do not establish an APK or GPU boot. No emulator, simulator,
ADB server or Metro process was started during this recovery. The task-2
fallback decision remains unchanged; no parent task state was modified.

### Other verification limitations

Expo's freshness check currently expects `expo ~58.0.14`,
`expo-crypto ~58.0.7`, `expo-dev-client ~58.0.14`,
`expo-system-ui ~58.0.6`, `react-native 0.88.0`, `jest-expo ~58.0.11`, rather
than the existing pins. This is not an Android compile failure authorizing an
upgrade. Full diagnostics were inspected at `/tmp/ew-task1-check.log`.
`expo-doctor`, final iteration checks, launch screenshots and owner acceptance
remain for later tasks. This task does not claim all checks pass.

The harness stopped its emulator; a `/proc/*/comm` inspection found no emulator
or QEMU process, then `flox activate -d .. -- adb kill-server` stopped the ADB
server started by this attempt. No Metro/simulator was started. No credentials,
cookies, authenticated headers or authenticated traffic were read or recorded.
No backend/Access/application/iOS changes were made. Iteration 003's owner
checks remain pending.
