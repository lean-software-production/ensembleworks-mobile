# Iteration 002: Launch on iOS 27 by upgrading to Expo SDK 58

## Goal

Advance the [ensembleWorks Mobile vision](../docs/vision.md) by making the app built in [iteration 001](001-join-existing-room.md) launch when built with Xcode 27. Today it compiles and installs but iOS terminates it at launch, before any application JavaScript runs.

Upgrade the app from Expo SDK 54 to the Expo SDK 58 pre-release, the first Expo release that adopts the UIScene lifecycle iOS 27 requires. Preserve iteration 001's behavior exactly: this iteration changes the platform under the app, not what the app does.

The first real iPhone-to-web call, previously the completion requirement for iteration 002, moves to iteration 003. It depends on an app that launches.

## Decisions

- Upgrade to the Expo SDK 58 pre-release rather than building with an older Xcode or hand-patching Expo 54's native startup.
- Accept pre-release dependencies, including a React Native release candidate, for now. Pin them exactly and record the move to stable releases as follow-up work.
- The acceptance environment is this Mac with Xcode 27 and the iOS 27 simulator, plus the existing Linux-compatible automated suite. No Apple ID, signing identity, or physical iPhone is required.
- Keep iOS as the first production platform. Keep the Android configuration if it survives the upgrade without extra work; it has no acceptance checks.
- Do not add product features, and do not start the Cloudflare sign-in or real-media work.

## Findings from 8 October 2026

These were observed on the Mac with Xcode 27.0 (build 27A266a), the iOS 27.0 SDK, and an iPhone 18 Pro simulator. Tools came from the repository's flox environment: Node 24.21.0, npm 11.19.0, CocoaPods 1.16.2.

- `npx expo prebuild --clean --platform ios`, `pod install` (88 pods), an unsigned generic-device build, and a simulator build all succeed on Expo 54 after commit `56867e5`.
- That commit added `plugins/minimumPodDeploymentTarget.js`. Without it the build fails because AsyncStorage's resource bundle declares iOS 13.4 and Xcode 27 accepts 15.0 and newer.
- The installed app crashes at launch with `EXC_BREAKPOINT` on the main thread in UIKit's `_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`, called from `-[UIApplication workspace:didCreateScene:withTransitionContext:completion:]`. The generated project has no `UIApplicationSceneManifest` and no scene delegate.
- Metro bundles the app's JavaScript for iOS without errors, so the crash is in native startup.
- The Expo SDK 57 project template (`expo-template-bare-minimum@57.0.29`, React Native 0.86.3) has no scene delegate either. The SDK 58 template (`58.0.15`) adds `SceneDelegate.swift`, an `ExpoAppSceneDelegate` subclass, and a `UIApplicationSceneManifest` entry.
- npm dist-tags on that date: `expo@latest` is 57.0.27 and `expo@next` is 58.0.6, published 6 October 2026. `react-native@latest` is 0.87.1 and `react-native@next` is 0.88.0-rc.4.
- `expo@58.0.6` expects React Native 0.88.0-rc.3, React 19.3.0, `expo-dev-client` ~58.0.11, `expo-crypto` ~58.0.5, `expo-system-ui` ~58.0.5, `jest-expo` ~58.0.8, and AsyncStorage 2.2.0. It supports Node 24.
- `@livekit/react-native` 3.0.0, `@livekit/react-native-webrtc` 144.2.0, and `@livekit/react-native-expo-plugin` 1.0.3 are still the latest releases. Their peer ranges allow any React Native version, which is not evidence that they compile against 0.88. `@config-plugins/react-native-webrtc` has releases up to 15.0.2; the app uses 13.0.0.

Treat the version numbers as a starting point. Re-check the registry and let `npx expo install` choose compatible versions when implementing.

A first factory run on this seed stopped at dependency installation. `@livekit/react-native-webrtc@144.2.0` declares the peer range `react-native >=0.60.0` and `@react-native-async-storage/async-storage@2.2.0` declares `^0.0.0-0 || >=0.65 <1.0`. Under npm's semver rules neither range matches a pre-release such as `0.88.0-rc.3`, so `npm install` fails with `ERESOLVE`. In a scratch project with the versions above, adding this to `package.json` resolved the whole tree to a single `react-native@0.88.0-rc.3`:

```json
"overrides": { "react-native": "$react-native" }
```

That probe resolved dependencies only. It did not install, compile, or run anything.

## Technical approach

Run every command inside the repository's flox environment (`flox activate` at the repository root) so Node, npm, and CocoaPods match the pinned versions. Do not install compilers or a second Node into that environment.

Follow Expo's upgrade guidance, including its advice to move one SDK version at a time where that surfaces problems earlier. Use `npx expo install --fix` and `npx expo-doctor` to align dependencies rather than choosing versions by hand. Regenerate `ios/` with prebuild; it stays git-ignored, so every native change must come from `app.json`, a config plugin, or a dependency.

Rely on Expo 58's own scene support. Do not write a custom scene delegate unless Expo 58's generated project still fails the launch check, and then document why.

Use the single `react-native` override shown in the findings so npm accepts the React Native release candidate. The peer ranges it bypasses exclude pre-releases by semver rule, not because those packages are known to be incompatible; whether they compile is established by the build steps below. Add no other override, and do not use `--force` or `--legacy-peer-deps`. Record the override in the README as temporary, to be removed when React Native 0.88 is released.

Keep `plugins/minimumPodDeploymentTarget.js` only if the build still needs it after the upgrade. Remove it and its `app.json` entry if every pod already declares a supported deployment target.

Keep the ports, adapters, application orchestration, and composition from iteration 001 unchanged except where an upgraded library's API forces a change. Make such changes inside the adapter that owns that library. Demo mode stays explicitly selected and visibly labeled; production mode stays unresolved.

If a LiveKit or WebRTC native module does not compile or link against the upgraded React Native, first try the versions those projects publish for it. If none works, stop and document the exact module, version, and error rather than forking or vendoring native code.

Provide a repeatable launch check that needs no taps. The development client asks for confirmation before opening a deep link, which blocks unattended launching through Metro. Prefer a simulator build with the JavaScript bundle embedded and demo mode selected, started with `xcrun simctl launch`, then confirm the process is still running and no new crash report exists.

## Implementation sequence

1. Upgrade Expo, React, React Native, and the Expo-managed packages to SDK 58 pre-release versions, and update the test tooling to match. Restore a passing automated suite, type check, and dependency check.
2. Align the LiveKit, WebRTC, and config-plugin dependencies with the upgraded React Native. Regenerate the iOS project and get `pod install` and an unsigned generic-device build to succeed with Xcode 27.
3. Build for the iOS 27 simulator and make the app launch without crashing. Confirm the generated project adopts the scene lifecycle. Add the repeatable launch check.
4. Exercise demo mode and unresolved production mode in the simulator and confirm they match iteration 001's documented behavior.
5. Update the README, the Linux verification report, and the device handoff for the new versions, the flox environment, Xcode 27, and the renumbering of the device work to iteration 003. Record pre-release risks and the path to stable releases.

## Acceptance scenarios

Run these on the Mac inside the flox environment.

- `npm ci` installs from the lockfile without `--force` or `--legacy-peer-deps`. `package.json` has exactly one override, `react-native` pinned to the app's own version, and `npm ls react-native` shows a single copy.
- `npm test` passes with every iteration 001 application, adapter, and component test still present. Tests may change only where an upgraded library's API requires it; no behavior assertion is weakened or removed.
- `npm run check` passes: type checking and `expo install --check` both report no problems. `npx expo-doctor` passes.
- `npx expo prebuild --clean --platform ios` followed by `pod install` succeeds, and the generated `Info.plist` contains a `UIApplicationSceneManifest`.
- An unsigned build for a generic iOS device succeeds with Xcode 27.
- A build for the iOS 27 simulator installs and launches. The process is still running 20 seconds after launch and no new `ensembleWorksMobile` crash report appears in `~/Library/Logs/DiagnosticReports`.
- Launched in demo mode, the app shows the "TEST ADAPTER MODE — no real media or backend" label and reaches the simulated call: sign in, save a name, join, see the simulated teammates, toggle microphone and camera, leave, and rejoin.
- Launched without `EXPO_PUBLIC_APP_MODE`, the app shows the unresolved production message, requests no permissions, and makes no backend request.
- The automated suite still runs with no credentials, device, simulator, or running LiveKit server, so it remains usable in the Linux Codespace.

## Validation and handoff

Iteration 002 is complete when the acceptance scenarios pass on the Mac and the documentation reflects the upgraded app. Record the exact versions installed, the Xcode and simulator versions used, and how to run the launch check.

Simulator results do not establish camera capture, real audio, Cloudflare sign-in, cookie sharing, WebSocket authentication, signing, or installation on a physical iPhone. The simulator has no camera. Say so in the handoff, as iteration 001 did for its test doubles.

Carry the existing device handoff forward as iteration 003's starting point rather than rewriting it: the production authentication adapter, signed build and install, authenticated contract and signaling checks, and the real media acceptance checklist are all still outstanding.

Report the result faithfully. If the app cannot be made to launch on Expo 58, the iteration ends with a documented blocker and the evidence for it, not with a claim of success from the automated suite alone.

## Deferred scope

Real Cloudflare sign-in, signing and physical-iPhone installation, and the phone-to-web call move to iteration 003. Moving from pre-release to stable Expo and React Native releases is follow-up work once they exist. Everything deferred in iteration 001 stays deferred, including Android acceptance testing.

## References

- [Iteration 001](001-join-existing-room.md)
- [Device handoff written in iteration 001](../docs/iteration-002-handoff.md)
- [Linux verification report](../docs/linux-verification.md)
- [Expo SDK upgrade walkthrough](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)
- [Apple: transitioning to the UIKit scene-based life cycle](https://developer.apple.com/documentation/technotes/tn3187-migrating-to-the-uikit-scene-based-life-cycle)
- [LiveKit React Native quickstart](https://docs.livekit.io/transport/sdk-platforms/react-native/)
