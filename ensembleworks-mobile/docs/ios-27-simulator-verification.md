# iOS 27 native verification

This record covers the native dependency alignment and unsigned generic-device
build. Simulator build, installation, launch, and app-flow evidence are tracked
by later iteration 002 work.

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
Launcher stripping local-network keys) but no build failures. This evidence is
not a simulator launch check and establishes neither camera/audio behavior nor
production authentication.
