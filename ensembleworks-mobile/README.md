# ensembleWorks Mobile

Expo/TypeScript native app. **Not Expo Go.** The explicitly selected demo renders
a simulated room and call controls; the default production mode remains unresolved
and does not claim a successful call. Iteration 002 upgrades the native shell to
Expo SDK 58 so it launches on iOS 27; it does not add real authentication, signaling,
or media. No credentials or LiveKit tokens belong in source.

See [the native Access integration gate](docs/native-access-integration.md) for
observed deployment redirects and native cookie-transport feasibility. The
[iteration 003 handoff](docs/iteration-002-handoff.md) carries forward production
adapter work, signing/install, and the real phone-to-web acceptance checklist.

## Dependency baseline

Expo SDK 58 pre-release (`expo` 58.0.6), React Native 0.88.0-rc.3, React
19.3.0, React DOM 19.3.0, Expo Crypto 58.0.5, Expo Dev Client 58.0.11,
Expo System UI 58.0.5, Jest Expo 58.0.8, and AsyncStorage 2.2.0 are pinned
exactly. LiveKit React Native 3.0.0, LiveKit WebRTC 144.2.0, LiveKit client
2.22.3, LiveKit Expo plugin 1.0.3, and WebRTC config plugin 15.0.2 remain in
use. `react-dom` matches React for LiveKit's transitive component peer; this
is not a web app. `package-lock.json` pins the resolved installation.

`package.json` has one temporary npm override: `react-native: "$react-native"`.
It lets npm accept the React Native release candidate where dependency peer ranges
exclude prereleases by semver rule. Remove that override and move Expo/React Native
to stable releases when React Native 0.88 and a compatible stable Expo SDK are
available; do not add overrides or use `--force`/`--legacy-peer-deps`.

`app.json` is the native configuration source. Plugins initialize LiveKit on both
platforms and configure WebRTC. `index.ts` installs WebRTC globals. Camera and
microphone usage descriptions are declared for iOS, with Android permission
scaffolding as well. Runtime permission requests are modeled and adapter-tested
on Linux; device behavior remains unverified. No
background calling or background camera modes are enabled. Generated `ios/` and
`android/` directories are ignored: regenerate rather than committing them.
The starter icon is from Expo's blank TypeScript template (0BSD).

## Codespace (Linux)

Run from this directory, not the factory project. On the Mac, use the
repository-root flox environment; it pins Node 24.21.0 and CocoaPods 1.16.2 and
leaves Apple's Xcode toolchain unshadowed:

```sh
flox activate -d .. -- npm ci
flox activate -d .. -- npm test
flox activate -d .. -- npm run check
flox activate -d .. -- npx expo-doctor
flox activate -d .. -- npx expo prebuild --clean --no-install
flox activate -d .. -- npx expo export --platform ios
```

The last two commands check config-plugin generation from a clean native project
and JavaScript bundling; they do **not** compile iOS or validate native media.
`--clean` replaces generated native directories; keep configuration in `app.json`. Linux cannot run Xcode or
install iOS CocoaPods. Generated folders and `dist/` may be deleted safely.

For Metro after a native development build is installed:

```sh
npm run start -- --tunnel
```

Expo may prompt to install its tunnel helper (`@expo/ngrok`). Open the resulting
development-client link/QR on the phone, not Expo Go. Codespace port forwarding
alone often gives an authenticated URL a phone cannot load; a tunnel is simpler.
Tunnel only development code, never secrets. A Metro tunnel does not proxy the
backend or bypass Cloudflare Access. Building and running Metro locally on the Mac
is the more reliable first native smoke test.

## Mac: iOS 27 build, simulator launch, and future device work

Prerequisites for the verified native build are macOS with **Xcode 27.0 (27A266a)**
and the iOS 27.0 simulator runtime (24A434), selected Command Line Tools, and the
repository-root flox environment (Node 24.21.0, npm 11.19.0, CocoaPods 1.16.2).
Xcode is installed separately; flox deliberately does not provide compilers. The
recorded native verification also notes the then-active flox shell reported Node
26.9.0/npm 11.19.1; see [the verification record](docs/ios-27-simulator-verification.md).
Use the currently pinned flox environment for repeatable commands.

### Repeatable iOS 27 simulator launch check

Boot an iOS 27 simulator, then run this unattended check from this directory:

```sh
flox activate -d .. -- npm run verify:ios-27-simulator-launch
```

It creates a Release simulator build with its JavaScript bundle embedded and
`EXPO_PUBLIC_APP_MODE=demo` supplied only to that build, installs it, launches it
with `xcrun simctl launch`, waits 20 seconds, and fails if the process dies or a
new `ensembleWorksMobile` crash report appears. Set `IOS_SIMULATOR_DEVICE` to a
booted simulator UDID if more than one is available. It is a launch check, not
native camera, audio, authentication, signaling, or physical-device coverage.
See [the native verification record](docs/ios-27-simulator-verification.md) for
the exact observed result and generated scene-lifecycle evidence.

### Future physical-device work (iteration 003)

1. Fetch the factory's committed changes and enter `ensembleworks-mobile/`.
2. Select Xcode and install the locked dependencies:

   ```sh
   sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -license accept
   flox activate -d .. -- npm ci
   flox activate -d .. -- npm run check
   flox activate -d .. -- npx expo prebuild --clean --platform ios
   flox activate -d .. -- bash -lc 'cd ios && pod install'
   open ios/ensembleWorksMobile.xcworkspace
   ```

   `--clean` deletes generated native changes. Prebuild normally installs pods;
   the explicit `pod install` ensures they are installed. Always open the workspace,
   not the `.xcodeproj`.
3. Connect/unlock the iPhone via USB, trust the Mac, and enable **Settings →
   Privacy & Security → Developer Mode** on the phone when prompted (restart if
   requested). In Xcode Settings → Accounts, add the Apple ID used for development.
4. In Xcode, choose the `ensembleWorksMobile` target → Signing & Capabilities,
   enable **Automatically manage signing**, and select your development Team.
   If `dev.ensembleworks.mobile` is unavailable for that team, change
   `ios.bundleIdentifier` in `app.json` to your unique reverse-domain identifier,
   regenerate, and select the team again. Do not commit signing secrets.
5. Select the connected iPhone as the run destination. Start Metro in another
   terminal on the Mac:

   ```sh
   npm run start -- --lan
   ```

   Keep Mac and phone on the same network; allow Node through the Mac firewall.
   Press Xcode's Run (⌘R) to build/install. If iOS asks, trust the development
   certificate under Settings → General → VPN & Device Management. In the
   development launcher select Metro or scan its QR code with Camera.
   Once signing is configured, `npm run ios` also builds to a selected device.
6. Expected smoke-test result: the **ensembleWorks Mobile** landing screen and
   unresolved production-mode message. No permission dialog and no active media
   are expected in this mode. Confirm absence of native-module/registration errors.

After changing native dependencies or app plugins, regenerate and rebuild the
native client; Metro reload alone is insufficient. Selecting a personal Team may
require rebuilding when its development provisioning expires. Android is only
scaffolded: with Android Studio/SDK and JDK 17 installed, `npm run android` builds
locally; Android acceptance is out of scope.

## Application ports and Linux adapter checks

Run `npm test` here (not in `factory/`). It runs Node/TypeScript application and
adapter tests plus Jest/Expo React Native component tests. Neither suite needs
credentials, a device, or a LiveKit server. Native video drawing is substituted
in component tests, not the application decisions. `npm run check` checks types and
Expo dependency compatibility.

- `src/application/ports.ts` defines authentication/session events, token retrieval,
  identity storage, permission requests, and room operations/events without native
  imports. Identity has a separate participant ID and display name.
- `src/application/composition.ts` selects injected production ports or explicitly
  selected deterministic demo adapters. Production has no usable ports by default;
  `UnresolvedAccessAuthentication` reports the unresolved session handoff rather
  than manufacturing a session. There is no fallback after a production failure.
- `src/adapters/testAdapters.ts` exposes controllable sign-in/expiry, permission
  denial, token errors/disabled media, room failures/participant events, operation
  traces, and cleanup state. Memory storage persists only while its adapter is
  reused, not across process launches. The app supplies AsyncStorage for demo
  identity persistence across launches.
- `src/application/joinApplication.ts` reuses a valid session or signs in, asks for
  a name once, saves a separate participant ID, requests both permissions, and
  joins immediately with auto-subscription and microphone/camera enabled. It never
  connects after a permission denial or disabled token response.
- `src/adapters/persistentIdentity.ts` serializes identity through an injected
  key-value boundary. The entry point supplies AsyncStorage and generates a
  `mobile-` UUID with Expo Crypto. Linux tests verify serialization, relaunch,
  independent same-name identities, ordering, and failed initial publications;
  actual device storage and permission behavior remain unverified.
- `src/adapters/httpTokens.ts` parses the modeled token contract through an injected
  authenticated transport. It requests logical room `team`, preserves the returned
  secure signaling URL/token, distinguishes disabled media from success, and
  rejects Access redirects/login HTML, malformed responses, and network failures.
  Demo sessions are rejected **before transport invocation**. The opaque session
  ID is not sent in a query/header or treated as a credential. A real transport
  must supply the supported Access session mechanism established in iteration 003;
  no production transport is currently installed.

To select the demo composition and see its persistent **TEST ADAPTER MODE — no
real media or backend** label on the application screen:

```sh
EXPO_PUBLIC_APP_MODE=demo npm run start -- --tunnel
```

Unset this variable for the default unresolved production composition. Only the
literal `demo` value enables test adapters. Tap **Simulate sign-in and join**, enter
a display name, then tap **Join room**. Permissions, token retrieval, and media
operations are simulated; the displayed joined state is not a real call. After
relaunch, tapping the sign-in/join button reuses the saved name and participant
ID without asking again. The two-column grid includes your test self-preview,
a simulated Alex video, and a Sam camera-off placeholder. Toggle **Mute microphone**
and **Turn camera off** (and back on), then **Leave** and **Rejoin room**. Participant
events replace the remote tiles; all remote audio gain requests use `1`. Leave
unsubscribes and requests media/audio cleanup; stale call events are ignored.
These are adapter assertions, not actual audio playback or camera capture.

`src/components/CallScreen.tsx` requires an injected video renderer. Demo uses
`DemoParticipantVideo`; `createNativeParticipantVideo` resolves a participant ID
into a LiveKit SDK track reference and uses `VideoTrack`, mirroring self only.
The unresolved native room composition must supply that resolver in iteration 003;
no production track or signaling connection is installed by this task.
Rebuild the native development client after installing the new AsyncStorage and
Expo Crypto dependencies (`npm run ios` on the Mac). Fake session/token values
are not production credentials and must never be sent to the deployed service.

`src/adapters/liveKitRoom.ts` maps injected LiveKit SDK operations/events and
native audio-session start/stop. Its SDK-boundary tests verify auto-subscription,
publication toggles, participant changes, gain, listener removal, and
`disconnect(true)` track release plus audio shutdown even when disconnect fails.
`src/adapters/nativePermissions.ts` maps WebRTC permission requests with a
native-module double. Neither is installed in demo mode or a production
composition yet.

The fixture/boundary tests verify HTTP parsing, SDK mappings, permission/storage
contracts and test-adapter observables, not real Cloudflare cookie sharing,
device permissions/storage, camera capture, audio playback, or deployed compatibility. Continue the unresolved
production authentication work using the
[native Access investigation](docs/native-access-integration.md) in iteration 003.

## Validation and remaining work

See [Linux verification](docs/linux-verification.md) for the acceptance-to-test
map and demo-mode instructions. This task passes 50 application/adapter tests,
8 component tests, `npm run check`, Expo Doctor (18/18), and `npm ls --all`.
The [iteration 003 handoff](docs/iteration-002-handoff.md) documents the unresolved
production adapters and physical-device acceptance gate. The iOS 27 simulator
launch is verified, but real-device acceptance remains unverified and belongs to
iteration 003.

Earlier Codespace checks completed for this scaffold: `npm run check`, Expo Doctor
(18/18), native prebuild without installation, and iOS Metro export. Generated
Info.plist includes camera/microphone descriptions and Android manifest includes
camera/record-audio permissions. These are **not** an Xcode build or a device test.
Xcode 27 compilation and a 20-second iOS 27 simulator launch are recorded in
[the native verification record](docs/ios-27-simulator-verification.md). Cloudflare
sign-in/session compatibility, token contract/room confirmation, physical-device
installation, signaling, and real phone-to-web media remain unverified and belong
to iteration 003. Linux test doubles and simulator demo tiles cannot establish
production compatibility.

`npm audit` reports 57 transitive findings (47 high, 10 moderate) after adding the
Jest/Expo component-test tooling. The prior scaffold had 34 findings; dependencies
were not force-upgraded as part of the call-UI task. Reported chains include
braces/micromatch, image-size, node-forge, postcss, and uuid/xcode. The suggested
forced changes include incompatible Expo/RN versions; they were not applied.
Do not expose Metro publicly beyond development needs or process untrusted build
inputs. Review patched compatible dependencies before distribution; no release
security claim is made here.
