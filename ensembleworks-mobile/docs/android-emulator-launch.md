# Android emulator launch check — task 3

## Reproduction

From the app directory:

```sh
flox activate -d .. -- npm run verify:android-emulator-launch
```

Default `ANDROID_LAUNCH_MODE=both`; `production` and `demo` can be selected
individually. Node is v24.21.0 from Flox. Each mode clean-prebuilds Android
(timeout 300s), builds a release (existing 2400s build bound), boots the scripted
headless factory emulator, installs, clears app state, and starts MainActivity.
It requires the same PID across 20 seconds, rejects a nonempty crash buffer,
and captures a screenshot. It stops its emulator on exit and refuses occupied
port 5580. No Metro, authentication, or interactive call is involved.

Exact build environment for each mode:
`EXPO_PUBLIC_APP_MODE=production` or `demo`,
`EXPO_PUBLIC_DEPLOYMENT_URL=https://canvas-ew-lsp-001.ensembleworks.dev/`,
`EW_ANDROID_ARCHITECTURES=x86_64`. The script sets these itself before prebuild
and build. Successful invocation used outer `timeout 3000` (exit 0).
Device: `emulator-5580`, `ensembleworks-api37-1-factory` AVD, Google APIs
API 37.1 ps16k x86_64 r9, emulator 37.2.12, Pixel 9 profile. Emulator bound 360s;
boot polling at most 120 attempts; each ADB call bounded to 30s.

APKs: `~/.local/share/ensembleworks-mobile/artifacts/iteration-004/launch/{production,demo}-x86_64-release.apk`.
Mode-associated checksums, results, empty crash buffers, screenshots and hardware
logs are in [evidence/android-launch](evidence/android-launch/). These are separate
from task 2's retained ARM64 APK, which was not rebuilt and does not contain this
keep-rule fix; rebuild it before a future device launch claim.

## Startup diagnosis and durable resolution

Task-local finding subtasks:
- [x] Reproduce original production/demo startup crashes.
- [x] Verify operator diagnosis rather than assume SIGILL is CPU incompatibility.
- [x] Resolve through durable Android configuration, retaining published pins.
- [x] Rerun both modes, retain crash-free 20-second results and inspect screenshots.

Original WebRTC 144.2.0 built/installed/started both modes, but SIGILL occurred
before the first PID check. Production backtrace reached WebRTC JNI_OnLoad.
Published 150.1.0 was tried; R8 failed with missing
`livekit.org.jni_zero.JniZeroJni`, referenced by `JniZero.setJniClassLoader`.
It was restored to 144.2.0; no dependency diff remains. This does not establish
a resolution for 150.1.0, which is not used.

Operator suggested name-based JNI lookup stripped by R8. Independently extracted
`lib/x86_64/liblkjingle_peerconnection_so.so` from the original production APK:
`objdump -d --start-address=0x50e300 --stop-address=0x50e330` confirms instruction
`0f 0b` (`ud2`) at `0x50e326`. A fresh factory launch, after uninstall/reinstall
and clearing logcat, inspected the **main** buffer filtered to `jni_zero`:

```text
W/jni_zero: jni_zero.cc:38 Failed to find class livekit/org/jni_zero/JniInit
```

Only this credential-free JNI diagnostic is retained, not general app/network
traffic. First diagnostic attempt encountered an emulator segmentation fault;
the second boot reproduced the JNI failure. No 16 KB or CPU-instruction
incompatibility is claimed.

`plugins/withLiveKitJniKeepRules.js`, registered in `app.json`, appends idempotent
keep rules for `livekit.org.webrtc.**` and `livekit.org.jni_zero.**` to generated
Android app ProGuard rules. Clean prebuild confirmed both rules, and the release
build consumes that file. Minification stays enabled. No native patch, fork,
vendoring, suppression or dependency upgrade was required. This Android-only
configuration resolves the observed failure while preserving iOS configuration,
ports, adapters, orchestration and application behavior.

## Passing launch evidence

Final full invocation log: `/tmp/ew-task3-keep-launch.log` (exit 0).
Production release build succeeded in 1m22s; install succeeded, launch Status ok,
PID **2362** survived 20 seconds, crash buffer empty. Demo clean release build
succeeded in 1m32s; install succeeded, launch Status ok, PID **2219** survived
20 seconds, crash buffer empty. See per-mode `*-result.txt` and APK checksums.

Both PNGs were visually inspected. Production shows “Production integration”,
sign-in explanation and “SIGN IN WITH GITHUB”, without a demo label. Demo shows
“TEST ADAPTER MODE — no real media or backend” and “SIMULATE SIGN-IN AND JOIN”.
No buttons were pressed or sign-in attempted.

## Final checks and limitations

All commands run through `flox activate -d .. --`:
- `timeout 300 npm test`: exit 0, 66 application plus 18 component tests,
  seven Jest suites; no earlier assertions changed.
- `timeout 300 npm run check`: exit 0, TypeScript and version gate pass.
- `bash -n scripts/verify-android-emulator-launch.sh`: pass.
- Invalid launch mode rejects with exit 2 before build/emulator.
- `git diff --check`: pass; `adb devices`: empty after cleanup.

Final test/check logs: `/tmp/ew-task3-final-{test,check}.log`.
No task-3 npm ci or Expo Doctor rerun is claimed. iOS scripts/configuration and
Darwin environment are unchanged; no Mac execution was possible here.

KVM, NVIDIA RTX 4060 Ti host GPU/GLES and Logitech C930e webcam enumeration are
confirmed in retained emulator logs. Front webcam and host audio input remain
configured. PulseAudio still reports `Could not init 'pa' audio driver`;
actual camera frames/audio calls and windowed mode remain unverified. All started
emulators were stopped; no Metro started. Owner Access sign-in, calls and physical
Pixel checks remain pending. Screenshots and retained credential-free evidence
were inspected; no cookies, tokens, authenticated headers or token-bearing URLs
were captured. No backend/Access changes. No concrete plan defect found.
