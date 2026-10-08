# iOS 27 native verification

This record covers the native dependency alignment, unsigned generic-device
build, simulator launch, and the mode-selection observations made during
iteration 002.

## Environment

- Repository: `ensembleworks-mobile`, Expo SDK `58.0.6`
- Node `v26.9.0`, npm `11.19.1`, CocoaPods `1.16.2` (from the repository's
  parent flox environment)
- Xcode `27.0` (`27A266a`), iPhoneOS SDK `27.0`
- Installed iOS simulator runtime: iOS `27.0` (`24A434`)

The native dependency set used for this check was:

| Package | Version |
| --- | --- |
| `react-native` | `0.88.0-rc.3` |
| `@livekit/react-native` | `3.0.0` |
| `@livekit/react-native-webrtc` | `144.2.0` |
| `@livekit/react-native-expo-plugin` | `1.0.3` |
| `@config-plugins/react-native-webrtc` | `15.0.2` |
| `@react-native-async-storage/async-storage` | `2.2.0` |

## Commands and results

All commands were run from `ensembleworks-mobile/` in the parent flox
environment:

```sh
flox activate -d .. -- bash -lc 'npx expo prebuild --clean --platform ios && cd ios && pod install'
flox activate -d .. -- bash -lc 'xcodebuild -workspace ios/ensembleWorksMobile.xcworkspace -scheme ensembleWorksMobile -configuration Release -sdk iphoneos CODE_SIGNING_ALLOWED=NO build'
```

Both commands succeeded. CocoaPods installed 111 dependencies. The unsigned
Release build for the generic iOS device finished with `** BUILD SUCCEEDED **`
on Xcode 27. It compiled and linked the LiveKit and WebRTC native modules; no
fork, vendored native code, `--force`, or `--legacy-peer-deps` was used.

The generated `ios/` directory is ignored. The clean prebuild generated:

- `ios/ensembleWorksMobile/Info.plist` with `UIApplicationSceneManifest` and a
  `UIWindowSceneSessionRoleApplication` configuration pointing to
  `$(PRODUCT_MODULE_NAME).SceneDelegate`.
- `ios/ensembleWorksMobile/SceneDelegate.swift`, whose `SceneDelegate` extends
  Expo's `ExpoAppSceneDelegate`.

Expo 58's generated Podfile declares iOS `16.4`; the pod install and unsigned
build succeeded without the former `minimumPodDeploymentTarget` config plugin.
That plugin and its `app.json` entry were removed rather than retaining an
unneeded generated-Podfile patch.

The build reports ordinary always-run script-phase warnings (including Expo Dev
Launcher stripping local-network keys) but no build failures.

## Simulator launch check

Run the unattended simulator check from the repository root in the flox
environment:

```sh
flox activate -d .. -- npm run verify:ios-27-simulator-launch
```

It finds the booted simulator (or accepts its UDID in `IOS_SIMULATOR_DEVICE`),
builds an iOS Simulator Release app with its JavaScript bundle embedded,
installs it, and launches it with `xcrun simctl launch`. It passes
`EXPO_PUBLIC_APP_MODE=demo` only to `xcodebuild`, so Expo embeds explicitly
selected demo mode without changing application source or affecting concurrent
builds. It then waits 20 seconds, rejects a slain app process, and rejects any
new `ensembleWorksMobile` crash report.

On 8 October 2026 this command succeeded on the booted iPhone 18 Pro, iOS 27.0
runtime (`24A434`), with Xcode 27.0 (`27A266a`): the Release simulator build
installed, `simctl launch` returned PID `47125`, and the process was still
running after 20 seconds with no new crash report.

## Mode observations

The demo Release bundle produced by the launch check was captured from that
simulator after launch. It displayed **TEST ADAPTER MODE — no real media or
backend** and the **Simulate sign-in and join** action. This confirms that the
embedded-bundle environment selected demo mode on the native simulator.

The complete simulated sign-in, display-name, `team` join, Alex/Sam teammate
tiles, microphone toggle, camera toggle, leave, and rejoin sequence was also
run by `npm test` in the entry-point component test `tests/demoMode.test.tsx`.
That test keeps the demo label visible throughout the sequence and passed on 8
October 2026 (50 application tests and 8 component tests passed). It uses test
adapters; it does not establish native camera or microphone capture.

For the production composition, a separate Release simulator bundle was built
with the variable explicitly absent and installed over the demo app:

```sh
env -u EXPO_PUBLIC_APP_MODE flox activate -d .. -- xcodebuild \
  -workspace ios/ensembleWorksMobile.xcworkspace \
  -scheme ensembleWorksMobile -configuration Release -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,id=A4008516-DAA2-4267-A096-5A750182B3A8' \
  -derivedDataPath .build/ios-27-simulator-production build
xcrun simctl uninstall A4008516-DAA2-4267-A096-5A750182B3A8 dev.ensembleworks.mobile
xcrun simctl install A4008516-DAA2-4267-A096-5A750182B3A8 \
  .build/ios-27-simulator-production/Build/Products/Release-iphonesimulator/ensembleWorksMobile.app
xcrun simctl launch A4008516-DAA2-4267-A096-5A750182B3A8 dev.ensembleworks.mobile
```

The build succeeded and the launched screen showed **Production integration
unresolved** and **Native Cloudflare sign-in remains unresolved for iteration
002.** It showed neither the demo label nor a sign-in/join control, so no
permission request was made and there was no UI path to a backend request.
`tests/productionMode.test.tsx` independently asserts the same entry-point
selection and absence of simulated join/room UI.

The factory run had no simulator touch-injection tool, so it could not tap
through the demo sequence itself. Xcode 27 has no `Simulator.app`; the simulator
window is opened from Xcode's bundled `DeviceHub.app`.

## Manual demo walkthrough

On 8 October 2026 the project owner walked the demo flow by hand in the
simulator window, on the demo Release build produced by the launch check
(iPhone 18 Pro, iOS 27.0, Xcode 27.0). The steps requested were: tap **Simulate
sign-in and join**, enter a name and join; see the simulated teammates and the
self tile; toggle microphone and camera off and on; leave and rejoin; and check
that the test-adapter label stays visible. The owner reported that everything
seemed to work and noted no problems. No screenshots or per-step notes were
captured.

This is a manual observation of simulated participants through test adapters.
Do not treat it as evidence of native media, production authentication, or a
real backend request.

## Final acceptance re-run — 8 October 2026

The complete acceptance command set was re-run in the parent flox environment
on this Mac (Node `v26.9.0`, npm `11.19.1`, CocoaPods `1.16.2`, Xcode `27.0`
`27A266a`, and the booted iPhone 18 Pro iOS `27.0` simulator, runtime
`24A434`):

```sh
flox activate -d .. -- npm ci
flox activate -d .. -- npm test
flox activate -d .. -- npm run check
flox activate -d .. -- npx expo-doctor
flox activate -d .. -- npm ls react-native
flox activate -d .. -- bash -lc 'npx expo prebuild --clean --platform ios && cd ios && pod install'
flox activate -d .. -- xcodebuild -workspace ios/ensembleWorksMobile.xcworkspace -scheme ensembleWorksMobile -configuration Release -sdk iphoneos CODE_SIGNING_ALLOWED=NO build
flox activate -d .. -- npm run verify:ios-27-simulator-launch
```

Every command succeeded. `npm ci` required neither force nor legacy peer
resolution; `npm ls` showed one deduplicated `react-native@0.88.0-rc.3` copy.
The automated suite passed all 50 application tests and 8 component tests;
`npm run check` passed and Expo Doctor reported 20/20 checks. The clean
prebuild and CocoaPods install completed with 111 pods, regenerated the scene
manifest and Expo scene delegate described above, and the unsigned generic
`iphoneos` Release build succeeded. The launch check built, installed, and
launched the embedded-demo Release bundle; `simctl` returned PID `59657`, which
remained running after 20 seconds with no new crash report.

The mode and manual-flow observations above remain the evidence for the two
UI acceptance scenarios: demo was explicitly labeled and manually exercised,
while the separately built unset-mode bundle displayed only the unresolved
production screen. The credential-free component and application tests cover
the modeled demo sequence and the absence of demo join UI in production. None
of this expands the stated simulator limitations or substitutes for iteration
003 physical-device, authenticated-backend, or real-media evidence.
