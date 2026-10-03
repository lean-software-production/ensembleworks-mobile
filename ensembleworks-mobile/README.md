# ensembleWorks Mobile

Expo/TypeScript native development scaffold for iteration 001. **Not Expo Go.**
The explicitly selected demo renders a simulated room and call controls; default
production mode remains unresolved and does not claim a successful call. The revised
[iteration 001](iterations/001-join-existing-room.md) builds the application and
call UI through ports and adapters with Linux test doubles. Iteration 002 will
verify real Cloudflare Access, native HTTP/WebSocket signaling, and media on an
iPhone. No credentials or LiveKit tokens belong in source.

See [the native Access integration gate](docs/native-access-integration.md) for
observed deployment redirects, native cookie-transport feasibility, the blocked
integration decision, and physical-iPhone verification steps. The authenticated
deployed token contract and native signaling remain unverified.

## Dependency baseline

Expo SDK 54, React Native 0.81.5, React 19.1, LiveKit React Native 3.0.0,
LiveKit WebRTC 144.2.0, LiveKit client 2.22.3, LiveKit Expo plugin 1.0.3,
and WebRTC config plugin 13.0.0 (the SDK 54-compatible line).
`react-dom` matches React to satisfy LiveKit's transitive components peer;
this is not a web app. `package-lock.json` pins the resolved installation.
Use Node 24.21.0 (`.nvmrc`) and npm 11.19.0, or the compatible Node engine range.

`app.json` is the native configuration source. Plugins initialize LiveKit on both
platforms and configure WebRTC. `index.ts` installs WebRTC globals. Camera and
microphone usage descriptions are declared for iOS, with Android permission
scaffolding as well. Runtime permission requests come in a later task. No
background calling or background camera modes are enabled. Generated `ios/` and
`android/` directories are ignored: regenerate rather than committing them.
The starter icon is from Expo's blank TypeScript template (0BSD).

## Codespace (Linux)

Run from this directory, not the factory project:

```sh
nvm install
nvm use
npm install --global npm@11.19.0
npm ci
npm run check
npx expo-doctor@1.20.4
npx expo prebuild --clean --no-install
npx expo export --platform ios
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

## Mac: generate, sign, build and install on an iPhone

Prerequisites: macOS with **Xcode 16.1 or newer**, selected Command Line Tools,
Node/npm as above, CocoaPods 1.16.2 (e.g. `brew install cocoapods`), and a physical
iPhone running iOS 15.1 or later. Use an Xcode version supporting your phone's
installed iOS. Accept Xcode's license and install its iOS platform components.

1. Fetch the factory's committed changes and enter `ensembleworks-mobile/`.
2. Select Xcode and install the locked dependencies:

   ```sh
   sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -license accept
   nvm install
   nvm use
   npm install --global npm@11.19.0
   npm ci
   npm run check
   npx expo prebuild --clean --platform ios
   npx pod-install ios
   open ios/ensembleWorksMobile.xcworkspace
   ```

   `--clean` deletes generated native changes. Prebuild normally installs pods;
   `pod-install` explicitly ensures they are installed. Always open the workspace,
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
   "Native development build ready." No permission dialog and no active media
   are expected yet. Confirm absence of native-module/registration errors.

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
  reused, not across process launches. SDK mappings remain to be implemented.
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
  must supply the supported Access session mechanism established in iteration 002;
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
The unresolved native room composition must supply that resolver in iteration 002;
no production track or signaling connection is installed by this task.
Rebuild the native development client after installing the new AsyncStorage and
Expo Crypto dependencies (`npm run ios` on the Mac). Fake session/token values
are not production credentials and must never be sent to the deployed service.

The fixture tests verify actual HTTP parsing and test-adapter observables, not
real Cloudflare cookie sharing, SDK event mappings, permissions, storage, camera
capture, audio playback, or deployed compatibility. Continue the unresolved
production authentication work using the
[native Access investigation](docs/native-access-integration.md) in iteration 002.

## Validation and remaining work

Codespace checks completed for this scaffold: `npm run check`, Expo Doctor
(18/18), native prebuild without installation, and iOS Metro export. Generated
Info.plist includes camera/microphone descriptions and Android manifest includes
camera/record-audio permissions. These are **not** an Xcode build or a device test.
Mac compilation, native launch, Cloudflare sign-in/session compatibility, token
contract/room confirmation, and all phone-to-web acceptance scenarios remain
unverified and belong to iteration 002. Scaffold checks alone do not complete
iteration 001: its revised application/component/adapter tests and handoff must
also pass. Linux test doubles cannot establish production compatibility.

`npm audit` reports 57 transitive findings (47 high, 10 moderate) after adding the
Jest/Expo component-test tooling. The prior scaffold had 34 findings; dependencies
were not force-upgraded as part of the call-UI task. Reported chains include
braces/micromatch, image-size, node-forge, postcss, and uuid/xcode. The suggested
forced changes include incompatible Expo/RN versions; they were not applied.
Do not expose Metro publicly beyond development needs or process untrusted build
inputs. Review patched compatible dependencies before distribution; no release
security claim is made here.
