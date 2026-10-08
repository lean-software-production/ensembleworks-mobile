# Iteration 003 handoff: physical iPhone-to-web call

## What iteration 002 established

Iteration 002 moved the native shell to Expo SDK 58 pre-release and React Native
0.88.0-rc.3 so it adopts UIKit's scene lifecycle required by iOS 27. On 8 October
2026, Xcode 27.0 (27A266a) built the unsigned generic-device target and an iPhone
18 Pro iOS 27.0 simulator build. The simulator process survived the unattended
20-second launch check and no new app crash report appeared. The generated project
contains `UIApplicationSceneManifest` and Expo's `SceneDelegate`.

This is launch evidence only. The simulator demo uses test adapters and does not
establish camera capture, audio playback, device permission behavior, Cloudflare
Access, authenticated HTTP/WebSocket signaling, token grants, signing, installation
on a physical iPhone, or a phone-to-web call. The simulator has no camera.
See [iOS 27 native verification](ios-27-simulator-verification.md) for commands
and exact observations, and [Linux verification](linux-verification.md) for the
credential-free automated suite.

## Toolchain and native baseline

Run commands in the repository-root flox environment from `ensembleworks-mobile/`:

```sh
flox activate -d .. -- npm ci
flox activate -d .. -- npm test
flox activate -d .. -- npm run check
flox activate -d .. -- npx expo-doctor
flox activate -d .. -- npx expo prebuild --clean --platform ios
flox activate -d .. -- bash -lc 'cd ios && pod install'
```

The flox manifest pins Node 24.21.0 and CocoaPods 1.16.2; Xcode is supplied by
macOS and must not be shadowed by another compiler environment. The recorded iOS
27 verification used Xcode 27.0 (27A266a) and iOS 27.0 simulator runtime 24A434.
The package baseline is Expo 58.0.6, React 19.3.0, React Native 0.88.0-rc.3,
Expo Crypto 58.0.5, Expo Dev Client 58.0.11, Expo System UI 58.0.5, Jest Expo
58.0.8, AsyncStorage 2.2.0, LiveKit React Native 3.0.0, LiveKit WebRTC 144.2.0,
LiveKit Expo plugin 1.0.3, and WebRTC config plugin 15.0.2.

`package.json` deliberately has exactly one temporary override:

```json
"overrides": { "react-native": "$react-native" }
```

It bypasses peer ranges that exclude the React Native release candidate by semver
rule. Do not add overrides or use `--force`/`--legacy-peer-deps`. Remove it and
move to stable Expo/React Native releases when React Native 0.88 and compatible
Expo packages are stable.

## Simulator launch check

With an iOS 27 simulator booted, run:

```sh
flox activate -d .. -- npm run verify:ios-27-simulator-launch
```

Set `IOS_SIMULATOR_DEVICE` to its UDID when necessary. The script embeds a Release
JavaScript bundle with demo mode selected only for that build, installs it with
`simctl`, launches it, waits 20 seconds, and rejects a dead process or new app
crash report. It does not replace the physical-device acceptance work below.

## Iteration 003: resolve production authentication first

Read [the native Access investigation](native-access-integration.md) before
implementing a session mechanism. Production composition intentionally has no
usable ports. Demo mode is explicitly selected and labeled; its sessions/tokens
must never be sent to production, and production failures must not fall back to
it.

With the deployment owner, establish an approved native handoff for Cloudflare
Access that covers native HTTP and the runtime returned WebSocket signaling host,
session reuse and expiry/revocation, and clearing invalid native session data.
Do not embed service credentials, scrape HttpOnly cookies with JavaScript, or put
cookies/JWTs in callback URLs. Browser or WebView login alone is not sufficient.
If supported native transport requires an owner-approved edge/deployment change,
record that exact decision before proceeding.

Then explicitly install the approved authentication/session adapter, authenticated
transport for `HttpTokenAdapter`, persistent identity storage, native permission
adapter, `LiveKitRoomAdapter`, native audio session operations, and participant
video resolver in the production composition. Preserve the existing application
ordering and behavior: distinct saved participant ID/name, permissions before
join, immediate enabled publications, auto-subscription, equal remote gain,
cleanup, expiry recovery, and no test-adapter fallback.

## Physical-device build and acceptance

Use a physical iPhone supported by the selected Xcode 27 (or later compatible)
installation. Select Xcode, accept its license, run the native commands above,
and open `ios/ensembleWorksMobile.xcworkspace` rather than the project file.
Configure a development team and a unique bundle identifier if required; keep
signing data and credentials out of source and logs. Start local Mac Metro only
when the installed development client needs it. A Codespace tunnel neither
proxies the backend nor authenticates Access.

Before media acceptance, an authorized user must prove native token retrieval for
logical room `team`, validate the non-secret returned contract, and make a fresh
native signaling connection to the returned host. Check relaunch and expired or
revoked sessions, then repeat on another network/cellular. Treat redirects/login
HTML as authentication failures and `{ enabled: false }` as unavailable media,
not a joined call.

Do not claim iteration 003 complete until a physical phone and web teammates prove:

- normal Access sign-in, saved name/independent identity, camera and microphone
  permission, and immediate join;
- real bidirectional audio/video, local preview, named remote tiles, multiple
  teammates at equal gain, and correct remote camera-off/participant updates;
- actual microphone and camera off/on behavior at a web peer;
- leave cleanup (including capture indicators and audio session), rejoin, relaunch,
  expiry/revocation, denied-permission, backend/media/signaling failure recovery;
- a fresh call on another network/cellular with no production-to-demo fallback.

Record revision, Mac/Xcode/device/iOS versions, owner-approved login/session
mechanism, non-secret contract conclusions, network, and pass/fail evidence for
each item. Keep cookies, raw authenticated headers, JWTs, and token-bearing URLs
out of logs, screenshots, and commits. Classify blockers as Access/session, token
contract/configuration, signaling, permissions/native modules, or media/network.
