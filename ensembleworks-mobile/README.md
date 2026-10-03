# ensembleWorks Mobile

Expo/TypeScript native development scaffold for iteration 001. **Not Expo Go.**
The landing screen loads the native LiveKit SDK but does not authenticate, join,
request media permissions, or claim a successful call. Cloudflare Access support
for native HTTP **and** WebSocket signaling must be verified on an iPhone next,
before implementing the call UI. No credentials or LiveKit tokens belong in source.

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

## Validation and remaining work

Codespace checks completed for this scaffold: `npm run check`, Expo Doctor
(18/18), native prebuild without installation, and iOS Metro export. Generated
Info.plist includes camera/microphone descriptions and Android manifest includes
camera/record-audio permissions. These are **not** an Xcode build or a device test.
Mac compilation, native launch, Cloudflare sign-in/session compatibility, token
contract/room confirmation, and all phone-to-web acceptance scenarios remain
unverified. Do not mark the iteration complete on the strength of these checks.

`npm audit` reports 34 transitive findings (24 high, 10 moderate) in this SDK's
tooling graph after non-breaking `npm audit fix`. Reported chains include
braces/micromatch, image-size, node-forge, postcss, and uuid/xcode. The suggested
forced changes include incompatible Expo/RN versions; they were not applied.
Do not expose Metro publicly beyond development needs or process untrusted build
inputs. Review patched compatible dependencies before distribution; no release
security claim is made here.
