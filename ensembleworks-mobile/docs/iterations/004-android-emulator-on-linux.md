# Iteration 004: Android build and a real call in the emulator, on Linux

## Goal

Advance the [ensembleWorks Mobile vision](../vision.md), which says to support Android when it fits naturally into the shared setup. Build the existing app for Android on the project owner's Arch Linux machine and run it in an x86_64 Android emulator. A person signs in through the normal Cloudflare Access login and joins the deployed team room. A web teammate sees and hears them through the host webcam and microphone passed into the emulator.

Iterations [001](001-join-existing-room.md) to [003](003-real-sign-in-and-room-in-simulator.md) targeted iOS. Android has had no build and no acceptance checks. This iteration adds a platform; it does not change what the app does.

The deployed web app is https://canvas-ew-lsp-001.ensembleworks.dev/.

## Decisions from the interview

- Acceptance happens in the Android emulator on this Linux machine. A physical Pixel on a recent Android release comes in iteration 005.
- Provision the toolchain through the repository's flox environment, extended for `x86_64-linux`. Install flox through the system's nix. Add JDK 17 and an Android SDK composed through a nix expression under `.flox/pkgs/`, with exact platform, build-tools, NDK, CMake, emulator, and system image versions.
- Time-box flox to the first task. If the flox-provided SDK cannot build the app, or cannot boot a GPU-accelerated emulator that sees the host webcam, within that task, fall back to a repository script that installs pinned packages with Google's `sdkmanager` into `~/Android/Sdk`. Node still comes from flox. Record what failed and why.
- Match the emulator to a recent Pixel: the latest stable Android release, Google APIs image, x86_64.
- The factory verifies the same depth as iteration 003: build, install, launch, survive, screenshot. Everything interactive, and everything that needs a sign-in, is verified by the owner.
- This iteration is independent of iteration 003's pending iOS owner checks. Those stay pending for the next Mac session. Record a finding on either platform that affects the other in the handoff.
- Stay on the current dependency pins. Upgrade a package only when an Android build or runtime failure points to it, and record the failure and the reason for the upgrade.
- Do not change the backend or the Access configuration. Only the project owner signs in. No agent enters, requests, stores, or reads credentials, and none are written to the repository, logs, or documentation.

## Findings to build on

Observed on 18 October 2026 on the owner's Linux machine unless stated otherwise.

- Arch Linux, kernel 7.0.12, 16 cores, 125 GB RAM, ample free disk. `/dev/kvm` exists and the owner is in the `kvm` group.
- No Android SDK, `adb`, `emulator`, or `sdkmanager` is installed, and `ANDROID_HOME` is unset. The default Java is 8; Java 17 and 26 are installed and selectable with `archlinux-java`.
- System nix 2.35.3 works. Flox is not installed. Node 24.19.0 comes from asdf; the repository and the flox manifest pin 24.21.0. The flox manifest already lists `x86_64-linux` but provides only Node, watchman, and Darwin-only CocoaPods.
- A webcam is present at `/dev/video0`. Audio runs through PipeWire with a PulseAudio interface; the default input is a Blue USB microphone.
- `android/` is git-ignored, like `ios/`. `app.json` already declares the package `dev.ensembleworks.mobile` and the `CAMERA`, `RECORD_AUDIO`, and `MODIFY_AUDIO_SETTINGS` permissions.
- The Access sign-in in `src/components/AccessSignIn.tsx` relies on `react-native-webview`'s `sharedCookiesEnabled`, which is an iOS-only prop. There is no custom native code. On Android, React Native's networking and WebSocket modules take cookies from a handler backed by the WebView's `CookieManager`, so the Access session should reach native `fetch` and LiveKit signaling without Android-specific code. This is a reading of the source, not an observed connection.
- Permissions are requested through `@livekit/react-native-webrtc`, which uses Android runtime permissions. The camera-unavailable path from iteration 003 depends on device enumeration and should not trigger when the emulator has a webcam.
- Nixpkgs builds an Android SDK with `androidenv.composeAndroidPackages`. Flox supports nix expression builds from files under `.flox/pkgs/`, which must be tracked by git. The SDK lands in the read-only nix store, so Gradle cannot install missing components on demand. The NixOS wiki warns that `sdkmanager` and `avdmanager` from a nix-built SDK may not work; nixpkgs provides `emulateApp` as an alternative. Whether a nix-built emulator finds the host GPU drivers on Arch is unverified.
- Whether `@livekit/react-native-webrtc` 144.2.0 compiles for Android against React Native 0.88.0-rc.3 is unknown.
- npm dist-tags on this date: `expo@latest` is 58.0.14 and `react-native@latest` is 0.88.0, both stable. `@livekit/react-native-webrtc` is 150.1.0, `@livekit/react-native` 3.1.0, `@livekit/react-native-expo-plugin` 1.1.0, and `livekit-client` 2.23.0. The app pins 58.0.6, 0.88.0-rc.3, 144.2.0, 3.0.0, 1.0.3, and 2.22.3. These are candidates if an Android failure requires an upgrade, not a plan to upgrade.

## Technical approach

Run every command as `flox activate -d .. -- <command>` without wrapping it in a login shell, and record `node --version` from the same kind of invocation in the evidence.

Extend the flox manifest for `x86_64-linux` only, so the Mac environment is unchanged. Provide JDK 17 and the composed Android SDK, and set `ANDROID_HOME` and `JAVA_HOME` from the environment. Accept the Android SDK license in the nix expression and allow only the unfree packages it needs. When Gradle asks for a component the SDK lacks, add it to the expression rather than letting Gradle download it. Do not install a second Node or system-wide Android packages.

Generate `android/` with `npx expo prebuild --platform android`. It stays git-ignored, so every native change must come from `app.json`, a config plugin, or a dependency. If a LiveKit or WebRTC module does not compile or link, first try the versions those projects publish. If none works, stop and document the exact module, version, and error rather than forking or vendoring native code.

Build a release variant with the JavaScript bundle embedded, signed with the debug keystore prebuild generates. The same APK can be sideloaded onto a phone in iteration 005. Select production or demo mode and the deployment with the existing `EXPO_PUBLIC_APP_MODE` and `EXPO_PUBLIC_DEPLOYMENT_URL` variables.

Define the emulator in a repository script, never by hand: Google APIs x86_64 image, KVM, host GPU, `hw.camera.front` set to the host webcam, and host audio input enabled. The script creates the virtual device if it is missing and can start it headless for the factory or with a window for the owner.

If the Access session does not reach native requests or LiveKit signaling on Android, a small Android-only fix is acceptable, such as flushing the WebView cookie store after sign-in or a config plugin. Keep it limited to the deployment's host. Never read cookies with page JavaScript, put a cookie or token in a URL, embed a service credential, or log a cookie, token, or authenticated header. If no such fix works, stop and document the blocker as iteration 003 describes.

Keep the ports, adapters, application orchestration, composition, and iOS configuration unchanged except where Android forces a change. Make such changes inside the adapter that owns the library. Demo mode stays explicitly selected and labeled, and production never falls back to it.

Every task must leave committable work. A task that only verifies records what it ran and observed in a document under `docs/`.

## Implementation sequence

1. Install flox through nix and extend the environment with JDK 17 and the composed Android SDK. Prove that a clean prebuild produces an APK and that the scripted emulator boots with GPU acceleration and lists the host webcam. If this task cannot finish, the next task replaces the SDK with the pinned `sdkmanager` fallback and records why.
2. Make the Android release build succeed through configuration, plugins, or justified version changes, and add `npm run build:android`.
3. Add `npm run verify:android-emulator-launch`: boot the emulator headless, install the APK, launch it, confirm the process is still running after 20 seconds with no crash in logcat, and capture a screenshot. Run it for production and demo modes.
4. Confirm the Access session reaches native requests and signaling on Android, from the source and with tests where possible. Add the Android-only cookie fix only if evidence shows it is needed.
5. Write the owner's Android acceptance checklist, a Linux and Android verification report, and Linux setup instructions in the README. Update the device handoff for iteration 005 on a physical Pixel.

## Acceptance scenarios

### Verified by the factory

Run on the Linux machine inside the flox environment, with no credentials.

- `npm ci`, `npm test`, `npm run check`, and `npx expo-doctor` pass. Every earlier test is still present, and no behavior assertion is weakened or removed.
- A clean `expo prebuild --platform android` followed by `npm run build:android` produces a release APK.
- The emulator launch check passes in production mode: the app installs, launches, is still running after 20 seconds with no crash in logcat, and a screenshot shows the sign-in entry point without the demo label.
- The same check passes in demo mode, and the screenshot shows the demo label.
- The iOS configuration and scripts still work as before; any change to shared files is justified in the verification report.
- Any dependency change is recorded with the Android failure that required it.
- No cookie, token, authenticated header, or token-bearing URL appears in the repository, in logs the app writes, or in the recorded evidence.

### Verified by the owner

The owner performs these by hand in the emulator window, with a web teammate in the room at the deployed URL and headphones to avoid feedback. Record each as passed, failed, or not attempted, with a screenshot where it helps.

- Sign in through the in-app Access login with GitHub, enter a display name once, grant the microphone and camera permissions, and join.
- The integration view shows an authenticated session, logical room `team`, and actual room `canvas-team`.
- The web teammate appears in the grid with their name and video, and can be heard through the host's audio output.
- The web teammate sees the mobile participant's video from the host webcam and hears audio from the host microphone.
- Turning the microphone off and on stops and restores the audio the web teammate hears.
- Turning the camera off and on stops and restores the video the web teammate sees.
- Leaving disconnects, and the web teammate sees the departure. Rejoining works.
- After closing and relaunching the app, the name is remembered and the session is reused without signing in again.
- After the owner revokes the session in Cloudflare, the next join returns to sign-in rather than spinning or switching to demo mode.

## Validation and handoff

The factory's work is complete when its scenarios pass and the owner's checklist is written and ready to run. The iteration is complete only when the owner has run that checklist and the results are recorded. Keep those two statements separate in the documentation, and do not mark an owner scenario as passed on the factory's evidence.

If the flox SDK was replaced by the fallback, say so in the handoff with the observed reason.

If sign-in cannot deliver a session that native requests and signaling both accept on Android, the iteration ends with a documented blocker: what was tried, what was observed without secrets, and the specific change that would resolve it.

Emulator results do not establish behavior of a phone's own camera, microphone, or audio routing, hardware video encoding, background or locked-screen behavior, battery use, or a call over a different network. Say so in the handoff.

For iteration 005, record what the owner needs: a Pixel with developer options and USB debugging enabled, the udev or `adb` setup on this machine, how to sideload the release APK, and the remaining acceptance checks.

## Deferred scope

The physical Pixel, calls over cellular or another network, background and locked-screen behavior, Play Store distribution and production signing, moving to stable Expo and React Native releases, backend or Access changes, a sign-out control, and everything deferred in earlier iterations stay deferred. Iteration 003's iOS owner checks remain pending and are not part of this iteration.

## References

- [Vision](../vision.md)
- [Iteration 001](001-join-existing-room.md), [iteration 002](002-upgrade-to-expo-58.md), and [iteration 003](003-real-sign-in-and-room-in-simulator.md)
- [Native Access investigation](../native-access-integration.md)
- [Device handoff](../device-handoff.md)
- [Credential-free verification](../linux-verification.md)
- [Flox nix expression builds](https://flox.dev/docs/concepts/nix-expression-builds)
- [Nixpkgs Android SDK documentation](https://github.com/NixOS/nixpkgs/blob/master/doc/languages-frameworks/android.section.md)
- [NixOS wiki: Android](https://wiki.nixos.org/wiki/Android)
- [Expo: Android development build on Linux](https://docs.expo.dev/get-started/set-up-your-environment/?platform=android&device=simulated)
- [LiveKit React Native quickstart](https://docs.livekit.io/transport/sdk-platforms/react-native/)
