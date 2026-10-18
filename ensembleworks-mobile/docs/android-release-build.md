# Android release reproducibility — task 2

## Outcome

Task-2 build and validation requirements now pass on this Linux host after the
owner's replacement approval below. No authentication was attempted. Earlier
retry sections are historical; the stable retry supersedes their approval,
blocker, gate and artifact results. Launch checks remain task 3; iteration and
owner acceptance are not claimed complete.

## Owner-authorized stable retry (latest)

The owner explicitly replaced the earlier limit: upgrades necessary to get the
Android build running are authorized, including React Native **0.88.0-rc.3 →
0.88.0** required by Check. This resolves the recorded approval conflict.
The five Expo patch changes in the ledger below remain owner-authorized
freshness changes, not remedies for the previously resolved Android header
failure. Expo remains SDK 58. No other direct dependency was upgraded.

Removed the temporary `react-native: "$react-native"` npm override as directed
by the README: stable RN installs successfully without the prerelease peer-range
workaround. Updated that README note to reflect the actual state.

Repair subtasks:
- [x] Record replacement approval, exact RN change and override removal.
- [x] Regenerate lock, install without overrides, run every required gate.
- [x] Clean-prebuild and retain/inspect the rebuilt ARM64 production release.

Each command used `flox activate -d .. --`: `npm install --package-lock-only`
(360s, exit 0), `npm ci` (360s, exit 0), `npm test` (300s, exit 0; 66 application
and 18 component tests, seven Jest suites), `npm run check` (300s, exit 0;
TypeScript and Expo version check pass), `npx expo-doctor` (300s, exit 0; 20/20).
No tests or assertions were removed or weakened; no exclusions were added.
Full local outputs: `/tmp/ew-stable-{lock,ci,test,check,doctor}.log`.

Repeated the exact clean production build command in the patch-retry section
below with outer `timeout --kill-after=30 2500`: exit 0, Node v24.21.0,
Gradle successful in 1m43s, 710 tasks executed. No generated files were edited.
Latest retained APK:
`/home/stag/.local/share/ensembleworks-mobile/artifacts/iteration-004/production-arm64-release.apk`.
SHA-256: `bde54dd115e6d74b19a32451958556d53000d376164793454879b99317eb6b6d`.
`unzip -l` confirms only ARM64 native libraries (same 18-library inventory as
the patch retry), embedded `assets/index.android.bundle` (2,984,428 bytes).
`apksigner verify --print-certs` exits 0 with Android Debug DN and certificate
SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
This is debug-keystore-signed release sideloading, not production signing.
Logs: `/tmp/ew-stable-{release,inspection}.log`.

Shared dependency changes affect iOS too; app.json, iOS scripts and Darwin
configuration are unchanged. **iOS was not rebuilt on this Linux host.**
No emulator or Metro was started. Production/demo launch checks remain unrun
(task 3), as do authenticated acceptance and physical Pixel execution.
Earlier fallback GPU/webcam evidence and audio initialization limitation remain
unchanged. No authentication traffic was captured; no backend/Access changes.

## Owner-authorized patch retry (historical)

The owner explicitly approved freshness-only patch updates to packages flagged
by Check/Doctor within SDK 58, to satisfy the required checks, **not because of
an Android failure**. The approval explicitly excludes stable React Native and
a different Expo SDK. Applied exact pins (package.json and package-lock.json):

| Package | Old | New |
| --- | --- | --- |
| expo | 58.0.6 | 58.0.14 |
| expo-crypto | 58.0.5 | 58.0.7 |
| expo-dev-client | 58.0.11 | 58.0.14 |
| expo-system-ui | 58.0.5 | 58.0.6 |
| jest-expo | 58.0.8 | 58.0.11 |

React Native remains 0.88.0-rc.3. Current Check output requires 0.88.0,
which is stable; this cannot be reconciled with the owner's explicit exclusion.
Concrete remaining contract defect: mandatory passing Check versus forbidden
stable RN transition. Validator must request resolution; no gate was suppressed
and no dependency exclusions or test assertions were changed.

Repair subtasks:
- [x] Record approval and apply only the five authorized patch pins.
- [x] Rerun CI, tests, Check, Doctor, clean prebuild and ARM64 release.
- [ ] Resolve stable-RN prohibition versus mandatory Check requirement.

All commands used `flox activate -d .. --`, without a login shell:
`npm install --save-exact expo@58.0.14 expo-crypto@58.0.7 expo-dev-client@58.0.14 expo-system-ui@58.0.6`
and `npm install --save-dev --save-exact jest-expo@58.0.11` (360s each, exit 0).
Then `npm ci` (360s, exit 0), `npm test` (300s, exit 0; unchanged 66 application
and 18 component tests, seven Jest suites), `npm run check` (300s, exit 1;
TypeScript passes, only RN mismatch remains), `npx expo-doctor` (300s, exit 0;
20/20). Full Check failure inspected at `/tmp/ew-approved-check.log`;
other output at `/tmp/ew-approved-{install,ci,test,doctor}.log`.

Clean production build (outer `timeout --kill-after=30 2500`, exit 0):

```sh
flox activate -d .. -- env EXPO_PUBLIC_APP_MODE=production \
  EXPO_PUBLIC_DEPLOYMENT_URL=https://canvas-ew-lsp-001.ensembleworks.dev/ \
  EW_ANDROID_ARCHITECTURES=arm64-v8a bash -c \
  'node --version; npx expo prebuild --clean --platform android && npm run build:android'
```

Node v24.21.0; Gradle succeeds in 1m58s, 710 tasks executed.
Latest retained APK replaces the historical artifact at
`/home/stag/.local/share/ensembleworks-mobile/artifacts/iteration-004/production-arm64-release.apk`.
SHA-256: `6fcb88437b3554b02d24e2f8d890f7f5ca2fe0279676af6c8cc43a4294198293`.
`unzip -l` confirms only `lib/arm64-v8a/` (18 libraries) and
`assets/index.android.bundle` (2,984,424 bytes). Current Expo replaces the earlier
`libexpo-kolibri.so` with `libexpo-modules-v2.so`; other library names match the
historical inventory below. `apksigner verify --print-certs` exits 0, same
Android Debug certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
Build/inspection logs: `/tmp/ew-approved-{release,inspection}.log`.

These are shared SDK patch updates, so iOS consumes updated dependencies too;
iOS configuration/scripts and Darwin toolchain were not changed. Mac execution
is unavailable here. No emulator or Metro was started; affected launch checks
remain task 3, unrun, not passes. Prior audio limitation remains. No credentials,
authentication traffic, backend or Access changes were involved.

## Durable changes and pins (historical)

Linux Flox activation now selects `~/Android/Sdk`; Node/JDK remain Flox-provided
(v24.21.0 / 17.0.20.1+1). Darwin activation, application code, iOS configuration,
tests and iOS scripts are unchanged. The composed expression remains historical;
it is no longer the active SDK. Task 1's read-only missing-component and host-GPU
failures are recorded in [the experiment](android-toolchain-attempt.md).

`scripts/install-android-sdk.sh` bootstraps command-line tools 22.0 from Google's
15859902 archive with SHA-256 validation, installs packages with sdkmanager, and
rejects revision drift. Pins: platform-tools 37.0.1; emulator 37.2.12 (current
stable); platforms 37.0 r2 and 37.1 r1; build-tools 36.0.0 and 37.0.0;
NDK 27.1.12297006; CMake 3.22.1; Google APIs ps16k x86_64 API 37.1 r9.
The stable emulator/image have advanced since task 1's metadata (37.1.11/r8).
Initial drift checks caught this; these current stable revisions were then
selected explicitly. The installer fails closed on later upstream drift;
sdkmanager cannot select old revisions of unversioned package IDs.

No dependency changes remain. Original package-lock.json was restored and npm ci
rerun. An initial native link failure referenced `JavaVM_*`/`JNIEnv_*` while
published fbjni/Kolibri libraries export `_JavaVM*`/`_JNIEnv*`. Flox CPATH exposes
the host JDK header before the NDK header. Clearing host include paths only in
`scripts/build-android.sh` fixes the ABI mismatch. An intermediate published
Expo 58.0.14/RN 0.88.0 experiment failed with the same symbols; those upgrades
were reverted. No native code was patched or vendored.

## Exact recipes and observations

Commands run from the app directory, each through `flox activate -d .. --` without
a login shell. `timeout` bounds below were outside that invocation.

| Command after Flox prefix | Outer timeout | Exit/result |
| --- | --- | --- |
| `node --version` | 60s | 0; v24.21.0 |
| `bash scripts/install-android-sdk.sh` | 300s (initial install 900s) | final 0; all revision checks pass |
| `npm ci` | 300s | 0 with original lock; audit reports 71 vulnerabilities, not automatically fixed |
| `bash -n scripts/build-android.sh scripts/install-android-sdk.sh scripts/android-emulator.sh` | 60s | 0 |
| `npm test` | 180s | 0; unchanged 66 application + 18 component tests, 7 Jest suites |
| `npm run check` | 180s | 1; TypeScript passes, freshness fails |
| `npx expo-doctor` | 180s | 1; 19/20 checks pass, freshness fails |
| `git diff --check` | 60s | 0 |

Clean release command (outer timeout 2400s, kill-after 15s):

```sh
flox activate -d .. -- env EXPO_PUBLIC_APP_MODE=production \
  EXPO_PUBLIC_DEPLOYMENT_URL=https://canvas-ew-lsp-001.ensembleworks.dev/ \
  EW_ANDROID_ARCHITECTURES=x86_64 bash -c \
  'npx expo prebuild --clean --platform android && npm run build:android'
```

Final exit 0: clean prebuild and 710 Gradle tasks, build successful in 1m37s.
APK: `android/app/build/outputs/apk/release/app-release.apk` (ignored).
`unzip -l` confirms `assets/index.android.bundle` (2,983,064 bytes in the first
successful original-pin build). `build-tools/37.0.0/apksigner verify --print-certs`
returns 0 and `CN=Android Debug, OU=Android, O=Unknown, L=Unknown, ST=Unknown, C=US`.
No production signing. The verified APK is x86_64-only; default build script omits
that override to include the phone architectures, not yet verified here.

Fallback boot: outer `timeout --kill-after=15 270`, Flox ran a temporary harness
setting `EW_EMULATOR_SECONDS=240`, starting
`bash scripts/android-emulator.sh headless`, polling
`adb -s emulator-5580 shell getprop sys.boot_completed` every two seconds (110
attempt maximum), and trapping cleanup with `adb ... emu kill`, process wait and
`adb kill-server`. Exit 0; property became 1; emulator reports boot in 20833ms.
KVM installed/usable; webcam enumeration lists Logitech Webcam C930e as webcam0
(YUYV); host Vulkan selects NVIDIA GeForce RTX 4060 Ti and GLES reports NVIDIA
610.43.02. No software renderer was substituted. API 37.1 ps16k r9 AVD created
with pixel_9 profile. Missing image devices.xml warning did not prevent boot.
Front webcam and audio input/output remain configured; no frame/call proof.
PulseAudio reports `Could not init 'pa' audio driver`: audio is **not verified**.
Windowed mode was not run. Emulator and ADB stopped; no Metro was started.

## Retry findings and ARM64 handoff proof

Task-2 repair subtasks (parent task remains unfinished):
- [x] Retain and inspect an ARM64-containing production APK after clean regeneration.
- [ ] Resolve freshness-gate/dependency-policy conflict with explicit owner authorization
  for freshness-only changes, then rerun required gates. No gate is suppressed.

The owner's subsequent clarification permits upgrades **when Android needs them**,
with the triggering Android failure and old/new versions recorded. It does not
approve the plan's requested freshness-only exception. No new Android failure
occurred, and no dependency was changed. Approval for that exception remains pending.

Retry command, outer `timeout --kill-after=30 2500`:

```sh
flox activate -d .. -- env EXPO_PUBLIC_APP_MODE=production \
  EXPO_PUBLIC_DEPLOYMENT_URL=https://canvas-ew-lsp-001.ensembleworks.dev/ \
  EW_ANDROID_ARCHITECTURES=arm64-v8a bash -c \
  'node --version; npx expo prebuild --clean --platform android && npm run build:android'
```

Exit 0, Flox Node v24.21.0, Gradle successful in 1m27s, 710 tasks
(678 executed, 32 up-to-date). No generated native source was edited.
Retained separately from subsequent emulator builds at
`/home/stag/.local/share/ensembleworks-mobile/artifacts/iteration-004/production-arm64-release.apk`.
SHA-256: `00a97d591d830fb6b1be6387bd89dae55d3227995913607811e29c58efaf271e`.

Inspection through Flox used `sha256sum`, `unzip -l`, and
`"$ANDROID_HOME/build-tools/37.0.0/apksigner" verify --print-certs` (exit 0).
The only native-library directory is `lib/arm64-v8a/`, containing 18 libraries:
libappmodules, libc++_shared, libexpo-kolibri, libexpo-modules-core,
libexpo-modules-jsi, libfbjni, libgifimage, libhermestooling, libhermesvm,
libimagepipeline, libjsi, liblkjingle_peerconnection_so, libnative-filters,
libnative-imagetranscoder, libnoise, libreactnative, libstatic-webp and
libzstd-kmp (all `.so`). `assets/index.android.bundle` is 2,982,768 bytes.
Certificate DN is `CN=Android Debug, OU=Android, O=Unknown, L=Unknown, ST=Unknown, C=US`;
certificate SHA-256 is
`fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
This is a debug-signed release for sideloading, not production signing or proof
of execution on a phone. The prior x86_64 build remains emulator evidence only.

After this build, repeated Flox gates: `npm ci` exit 0 (69 audit vulnerabilities),
`npm test` exit 0 (66 application + 18 component tests), `npm run check` exit 1
(TypeScript passes; same six version expectations), `npx expo-doctor` exit 1
(19/20; same five patch mismatches). Timeouts respectively 300/180/180/180 seconds.
Full failure diagnostics inspected in `/tmp/ew-task2-retry-{check,doctor}.log`;
other retry evidence: `/tmp/ew-task2-retry-{ci,test}.log`,
`/tmp/ew-task2-arm64-{release,inspection}.log`. No emulator or Metro started in
this retry. iOS files/scripts and dependency lock remain unchanged.

## Approval-hold verification retry

Current validator finding retained as task-2 subtasks:
- [x] Recheck the four mandatory gates on this host without changing pins.
- [ ] Obtain explicit owner authorization under the accepted freshness hold;
  then rerun all four gates, clean builds and affected launch checks.

No such authorization is present in this run context. Existing work was
preserved; no dependency, source, test or build configuration was changed in
this retry. No new build, emulator, Metro or authentication session was started.
The previously recorded ARM64 artifact proof is preserved, not claimed as a
new build result.

Executed `flox activate -d .. -- bash -c` with `node --version` and each of
`npm ci`, `npm test`, `npm run check`, `npx expo-doctor` bounded by
`timeout --kill-after=15 300`. Node reports v24.21.0. CI and tests exit 0;
Check and Doctor exit 1. Tests retain all 66 application and 18 component
assertions (7 Jest suites). TypeScript passes; Check still rejects the six
versions listed below; Doctor passes 19/20 and rejects the same five patch
versions. Full failure diagnostics were inspected at
`/tmp/ew-task2-hold-check.log` and `/tmp/ew-task2-hold-doctor.log`;
CI/test output is in `/tmp/ew-task2-hold-{ci,test}.log`.
`git diff --check` passes. Flox warns that FloxHub is not signed in, but local
activation succeeds; no sign-in was attempted. Existing gate exclusions were
not changed. Task 2 remains blocked, with no gate waived.

## Blocker requiring plan decision

`npm run check` expects Expo ~58.0.14, crypto ~58.0.7, dev-client ~58.0.14,
system-ui ~58.0.6, RN 0.88.0 and jest-expo ~58.0.11; Doctor rejects the five
Expo patch pins. Current pins build after the environment-only fix. The seed
allows upgrades only for demonstrated Android build/runtime failures and defers
general stable upgrades. Thus freshness-only upgrades or suppressing validation
would amend accepted behavior. Validator should request a plan decision resolving
these conflicting requirements; this attempt does neither and claims no gate pass.

Full local diagnostics inspected: `/tmp/ew-task2-check.log`,
`/tmp/ew-task2-doctor.log`, `/tmp/ew-task2-release.log`,
`/tmp/ew-task2-release-patch.log`; successful final evidence in
`/tmp/ew-task2-{final-ci,sdk-final,test,release-final,boot,emulator}.log`.
Evidence contains only credential-free operations; no app authentication traffic
was captured. Public ADB key diagnostics are not retained here. Repository diff
contains no credentials/cookies/authenticated headers or token-bearing URLs.
No backend/Access changes. Mac regressions, authenticated behavior, release launch
checks/screenshots (task 3), audio and physical Pixel remain unverified.
