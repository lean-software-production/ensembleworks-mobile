# Iteration 002: physical iPhone-to-web handoff

## Completion boundary

Iteration 001 establishes modeled application behavior through Linux application,
component, and adapter tests, plus type/dependency checks and this handoff. It
requires no Mac, credentials, running LiveKit server, or physical device. The
[Linux verification map](linux-verification.md) describes those checks.

Those tests do **not** establish real Cloudflare sign-in, cookie sharing, native
HTTP/WebSocket authentication, device permissions/storage, camera capture, audio
playback, or deployed compatibility. Native prebuild and JavaScript export are
not an Xcode build. No real phone-to-web call has been verified.

Iteration 002 is complete only after a physical iPhone joins the deployed web
teammates with real two-way audio/video and the acceptance checks below pass.
Android acceptance, background calling, CallKit, and distribution remain out of
scope. Expo Go is not a supported runtime.

## First resolve production authentication

Read the [native Access investigation](native-access-integration.md) before
implementing a session mechanism. The observed unauthenticated redirects are
historical evidence, not confirmation of the authenticated deployed contract.

Current production composition has no installed usable ports. The
`UnresolvedAccessAuthentication` adapter deliberately cannot sign in. Demo mode
is explicitly selected and labeled; its sessions/tokens must never be sent to
production. Do not add a silent fallback when production sign-in or media fails.

With the deployment owner, confirm:

- Normal Cloudflare Access login and the identity provider's embedded-login policy.
- A supported handoff into native HTTP and WebSocket transports, including cookie
  scope/expiry and coverage of the **runtime returned signaling host**.
- Session reuse, expiry/revocation detection, and clearing invalid native session
  data before returning to sign-in.

Browser or WebView login alone is insufficient. The investigation's native
cookie-transfer candidate is unimplemented and requires owner approval and
physical-device evidence. Never embed Access service credentials, scrape
HttpOnly cookies with JavaScript, or put cookies/JWTs in callback URLs. If the
current configuration cannot support native transport, document the specific
owner-approved handoff/edge change before expanding scope. No backend change is
assumed.

## Mac build, signing, and installation

Use the full [README Mac procedure](../README.md#mac-generate-sign-build-and-install-on-an-iphone)
for prerequisites and troubleshooting. On the Mac, fetch the factory's committed
changes and run these from the target `ensembleworks-mobile/` directory:

```sh
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
nvm install
nvm use
npm install --global npm@11.19.0
npm ci
npm test
npm run check
npx expo prebuild --clean --platform ios
npx pod-install ios
open ios/ensembleWorksMobile.xcworkspace
```

Use Xcode 16.1 or newer (a version supporting the phone's installed iOS),
CocoaPods 1.16.2, and a physical iPhone with iOS 15.1 or newer. Prebuild `--clean`
replaces generated native changes; retain native configuration in `app.json`.

1. Connect/unlock the phone, trust the Mac, and enable iOS Developer Mode.
2. Add the developer Apple ID in Xcode Settings → Accounts. Select the
   `ensembleWorksMobile` target → Signing & Capabilities, automatically manage
   signing, and select the development Team.
3. If necessary, set a unique `ios.bundleIdentifier` in `app.json`, regenerate,
   and reselect the Team. Keep signing secrets out of source and logs.
4. Select the physical phone as the destination. In a second terminal, start
   `npm run start -- --lan` with Mac and phone on the same network, then Run (⌘R)
   in Xcode. Trust the development certificate if prompted and select Metro in
   the development launcher. After signing is configured, `npm run ios` can also
   build/install to the selected device.
5. Initially leave `EXPO_PUBLIC_APP_MODE` unset. The expected current result is
   the unresolved production message, not a call or permission prompt. Check for
   native registration errors. Rebuild the native client after native dependency
   or plugin changes; a Metro reload is insufficient.

A Codespace Metro tunnel can serve development JavaScript to an installed client
(see README), but does not authenticate or proxy the backend. Start on local Mac
Metro to isolate transport issues. Personal-Team provisioning may need renewal.

## Wire real adapters, without changing application decisions

- Implement the approved authentication/session adapter and native authenticated
  transport behind the existing ports. Install `HttpTokenAdapter` with that
  transport; an opaque application session ID is not an Access credential.
- Supply persistent identity storage and actual native permission requests.
  Keep the remembered display name separate from the stable `mobile-` participant
  ID; two people with the same name must not replace each other.
- Bind `LiveKitRoomAdapter` to actual SDK room/events and native audio-session
  operations. Supply `createNativeParticipantVideo` with a resolver from
  participant IDs to actual SDK track references, including local camera tracks.
- Inject these ports into production composition explicitly. Preserve application
  permission ordering, immediate camera/microphone publication, auto-subscription,
  equal remote gain, cleanup ownership, and expiry handling.
- Keep Linux adapter/behavior/component tests passing and add regression tests
  for the chosen auth transport. Doubles cannot replace the following device gate.

## Verify authenticated contract and signaling before media acceptance

An authorized human must complete normal Access login on the phone. Follow the
investigation's six integration checks, using native transport, not WebView
JavaScript. Require:

1. Native `GET https://canvas-ew-lsp-001.ensembleworks.dev/api/av/token` with
   logical `room=team`, saved display name, and a distinct mobile identity returns
   successful JSON `{ enabled: true, token, url }`. Redirects/login HTML are auth
   failures; `{ enabled: false }` is unavailable media, not a successful join.
2. Inspect grants locally for identity, name, expiry, join/publish/subscribe and
   expected LiveKit room `canvas-team`. JWT decoding is not signature validation.
   If deployment differs from the pinned source contract, resolve the discrepancy
   with the owner rather than silently changing rooms.
3. Connect an initially non-publishing native LiveKit probe to the returned URL
   and token. Confirm native connected state, actual room `canvas-team`, and a
   web teammate in that room. Successful token HTTP alone does not verify the
   protected signaling handshake. Disconnect and stop the probe audio session.
4. Verify fresh HTTP and signaling on relaunch with a valid session, then after
   expiry/revocation. The expired case must return to sign-in, not spin forever
   or fall back to demo. A surviving socket does not prove a fresh handshake.
5. Repeat native token retrieval and signaling on cellular/a different network.

## Real media acceptance checklist

Use the deployed web app at https://canvas-ew-lsp-001.ensembleworks.dev/ with no
room query (logical `team`). Use at least two web teammates for the multiple-
participant check. These checks must use real adapters, not demo tiles.

- [ ] First launch: normal Access sign-in, enter name once, grant microphone and
  camera permissions, and join immediately without a pre-join preview.
- [ ] Phone and web teammates both see and hear each other; the phone shows real
  self-preview and named remote video tiles. Confirm audio in both directions,
  not just a connected indicator or publication flag.
- [ ] Multiple web teammates appear in the grid, each audible at equal gain
  (no canvas-position/spatial mixing). Test two distinct identities sharing a
  display name without participant replacement.
- [ ] Microphone off/on actually stops/restores outgoing audio at a web peer.
  Camera off/on stops/restores outgoing video and updates self-preview.
- [ ] Remote camera-off shows a named placeholder. Remote join/leave and track
  changes update the grid without stale tiles; an empty room is understandable.
- [ ] Leave disconnects, releases local capture, stops the native audio session,
  and removes listeners. Confirm iOS capture indicators cease and web peers see
  departure. Rejoin works; late events from the old call do not restore its UI.
- [ ] Terminate/relaunch: name and separate participant ID persist. A valid
  session is reused where supported; an expired/revoked session requests sign-in
  and supports recovery without retaining the previous call.
- [ ] Denied camera/microphone permissions show an actionable state with no
  false joined state. Restore permissions in Settings and retry successfully.
- [ ] Unreachable backend, unavailable media, and signaling failure stop joining
  with understandable retry/sign-in guidance and release any acquired media.
  Production failures never activate test-adapter mode.
- [ ] Repeat a fresh phone-to-web call on cellular/a different network, verifying
  actual bidirectional audio/video rather than signaling alone.

## Evidence and blockers

Record build revision, Mac/Xcode/device/iOS versions, approved login/session
mechanism, non-secret contract conclusions, network used, and pass/fail evidence
for each checklist item. Keep credential values, cookies, raw authenticated
headers, JWTs, and token-bearing URLs out of screenshots, logs, and commits.
Classify failures separately as Access/session, token contract/configuration,
signaling, permissions/native modules, or media/network failures. Record the
owner decision and exact integration change when blocked; do not claim success
from simulated checks. The planner, not this documentation task, determines
iteration completion from that evidence.
