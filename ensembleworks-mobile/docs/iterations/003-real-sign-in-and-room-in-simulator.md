# Iteration 003: Real sign-in and a real room, in the iOS simulator

## Goal

Advance the [ensembleWorks Mobile vision](../vision.md) by replacing the unresolved production mode with real adapters. A person signs in through the normal Cloudflare Access login inside the app and joins the deployed team room from the iOS 27 simulator, seeing and hearing a web teammate.

Iterations [001](001-join-existing-room.md) and [002](002-upgrade-to-expo-58.md) established the application behavior against test doubles and a native shell that launches on iOS 27. Nothing has yet talked to the deployed backend with a real session. This iteration removes that unknown before any signing or device work.

The signed install on a physical iPhone, camera capture, and the phone-to-web call on a different network move to iteration 004.

The deployed web app is https://canvas-ew-lsp-001.ensembleworks.dev/.

## Decisions from the interview

- Prove real sign-in and a real room join in the simulator first. No Apple ID, signing identity, or physical iPhone is needed in this iteration.
- Sign in inside the app with the normal Access login, then make that session available to native requests. Do not change the backend or the Access configuration.
- The project owner administers the Cloudflare Access application and the deployment. If the in-app approach cannot work, stop and document the exact change needed; do not implement it in this iteration.
- Iteration 004 will use a physical iPhone signed with a free Apple ID.
- Only the project owner signs in. No agent enters, requests, stores, or reads credentials, and none are written to the repository, logs, or documentation.

## Findings to build on

Observed on 8 October 2026 unless stated otherwise.

- The Access login page for the deployment offers one sign-in method, GitHub.
- Unauthenticated requests to `/`, `/api/av/token`, and `/livekit/` return HTTP 302 to Cloudflare Access rather than JSON or a WebSocket upgrade. See the [native Access investigation](../native-access-integration.md), recorded on 3 October 2026.
- React Native 0.88.0-rc.3's `RCTWebSocketModule.mm` still builds the WebSocket handshake's cookie header from `NSHTTPCookieStorage.sharedHTTPCookieStorage`, mapping `wss` to `https` for the lookup. `livekit-client` 2.22.3 opens signaling with the global `WebSocket` and no custom headers. A correctly scoped Access cookie in the shared native store should therefore reach both native `fetch` and LiveKit signaling. This is a reading of the source, not an observed connection.
- A `WKWebView` keeps its own cookie store. Showing the login page in a web view does not by itself put the session in the shared native store.
- Expo 58.0.6 lists `react-native-webview` 14.0.1 as its compatible version. Its `sharedCookiesEnabled` option is the first candidate for moving cookies between the web view and the shared store. Whether it carries the HttpOnly Access cookie is unverified.
- The token contract from the backend source is `GET /api/av/token?room=team&identity=<id>&name=<name>` returning `{ enabled: true, token, url }`, or `{ enabled: false }` when media is not configured, with logical room `team` granted as LiveKit room `canvas-team`. The deployed, authenticated response has never been observed.
- The iOS simulator has no camera. Microphone input comes from the Mac.
- The factory cannot tap or type in the simulator. In iteration 002 the owner walked the interactive checks by hand.
- The factory stops when a validated task leaves nothing to commit.
- Iteration 002's evidence recorded Node 26.9.0 although the flox environment pins 24.21.0. Commands wrapped in a login shell (`bash -lc`) inside `flox activate` appear to put another Node first on `PATH`.

## Technical approach

Keep the application orchestration, ports, and call UI from iteration 001. Add real adapters behind the existing ports and install them explicitly in the production composition. Demo mode stays explicitly selected and labeled, and a production failure never falls back to it.

Select the deployment with a build-time variable holding its base URL. When the variable is absent, production mode stays unconfigured and says so; do not hard-code the deployment into application logic.

Implement the authentication port with an in-app web view that loads the deployment and lets Cloudflare Access run its normal GitHub login. Treat sign-in as complete only when a native request, not web-view JavaScript, reaches the deployment without being redirected to Access. Try `react-native-webview`'s shared-cookie support first. If the session does not reach the shared native store, a small native module that copies the deployment's cookies from the web view's store to the shared store is acceptable, preserving their Secure, HttpOnly, domain, path, and expiry attributes and limited to the deployment's host. Never read cookies with page JavaScript, put a cookie or token in a URL, embed a service credential, or log a cookie, token, or authenticated header.

Reuse a session that is still valid on relaunch. Treat an Access redirect or login HTML from the token endpoint as an expired session: clear the stored session for the deployment, return to sign-in, and stop retrying. Cover these decisions with tests against fixtures, as iteration 001 did for the token adapter.

Install the existing HTTP token adapter with the native authenticated transport. Bind the LiveKit room adapter to the real SDK room, events, and native audio session, and give the participant video component a resolver from participant IDs to real SDK tracks. Use the URL the token endpoint returns for signaling; do not assume its host. If that host is not covered by the Access session, stop and document it.

Decide what joining means when the camera cannot start. In the simulator it never can. Stay joined with the microphone, show the camera as off, and tell the person the camera is unavailable. Do not report the camera as enabled, and do not treat a missing camera as a failed join. A denied permission stays the actionable failure iteration 001 defined.

Show enough on screen for a screenshot to serve as evidence without exposing secrets: that the session is authenticated, the logical and actual room names, the connection state, and the participants present.

Extend the unattended launch check so a production-mode simulator build can be built with its JavaScript embedded, installed, and launched without taps. The factory verifies everything up to the sign-in screen this way. Sign-in and everything after it is verified by the owner.

Run commands as `flox activate -d .. -- <command>` without wrapping them in a login shell, and record `node --version` from the same kind of invocation in the evidence.

Every task must leave committable work. A task that only verifies records what it ran and observed in a document under `docs/`.

## Implementation sequence

1. Add the deployment configuration and the in-app Access sign-in adapter, with the session reaching native requests. Cover session reuse, expiry, and failure handling with fixture-based tests.
2. Install the token adapter with the authenticated transport and add an integration view showing the non-secret result of a token request.
3. Bind the room adapter, audio session, and participant video to the real LiveKit SDK, including the camera-unavailable behavior, and install the real adapters in the production composition.
4. Extend the simulator launch check to production mode and verify the unattended part: the build installs, launches, survives, and shows the sign-in entry point.
5. Write the owner's acceptance checklist and update the README, verification reports, and device handoff. Rename the device handoff to an iteration-neutral name and fix its links.

## Acceptance scenarios

### Verified by the factory

Run on the Mac inside the flox environment, with no credentials.

- `npm ci`, `npm test`, `npm run check`, and `npx expo-doctor` pass. Every earlier test is still present, and no behavior assertion is weakened or removed.
- New tests cover: sign-in completing only after an authenticated native request succeeds; a valid session being reused; an Access redirect or login HTML being treated as expiry, clearing the session and returning to sign-in; a missing deployment URL leaving production unconfigured; and joining with the microphone when the camera is unavailable.
- Demo mode still passes its launch check and still shows its label. No demo session or token is ever sent to the deployment.
- A production-mode simulator build installs and launches, the process is still running after 20 seconds with no new crash report, and a screenshot shows the sign-in entry point without the demo label.
- No cookie, token, authenticated header, or token-bearing URL appears in the repository, in logs the app writes, or in the recorded evidence.

### Verified by the owner

The owner performs these by hand in the simulator window with a web teammate in the room at the deployed URL, using headphones to avoid feedback. Record each as passed, failed, or not attempted, with a screenshot where it helps.

- Sign in through the in-app Access login with GitHub, enter a display name once, grant the microphone permission, and join.
- The integration view shows an authenticated session, logical room `team`, and actual room `canvas-team`.
- The web teammate appears in the grid with their name and video, and can be heard in the simulator.
- The web teammate sees the mobile participant by name and hears audio from the Mac's microphone.
- The camera shows as off with a notice that it is unavailable, and the call stays connected.
- Turning the microphone off and on stops and restores the audio the web teammate hears.
- Leaving disconnects, and the web teammate sees the departure. Rejoining works.
- After quitting and relaunching, the name is remembered and the session is reused without signing in again.
- After the owner revokes the session in Cloudflare, the next join returns to sign-in rather than spinning or switching to demo mode.

## Validation and handoff

The factory's work is complete when its scenarios pass, the real adapters are installed in the production composition, and the owner's checklist is written and ready to run. The iteration is complete only when the owner has run that checklist and the results are recorded. Keep those two statements separate in the documentation, and do not mark an owner scenario as passed on the factory's evidence.

If sign-in cannot deliver a session that native requests and signaling both accept, the iteration ends with a documented blocker: what was tried, what was observed without secrets, and the specific backend or Access change that would resolve it.

Simulator results do not establish camera capture, behavior on a physical iPhone, signing, installation, background or locked-screen behavior, or a call over a different network. Say so in the handoff.

For iteration 004, record what the owner needs: a physical iPhone, a free Apple ID added to Xcode, the limits of a free personal team including the seven-day provisioning expiry and the possible need for a unique bundle identifier, and the remaining acceptance checks from the device handoff.

## Deferred scope

Signed installation on a physical iPhone, camera capture and outgoing video, calls over cellular or another network, and multiple simultaneous web teammates as an acceptance requirement move to iteration 004. Backend or Access changes, a sign-out control, moving to stable Expo and React Native releases, and everything deferred in earlier iterations stay deferred.

## References

- [Vision](../vision.md)
- [Iteration 001](001-join-existing-room.md) and [iteration 002](002-upgrade-to-expo-58.md)
- [Native Access investigation](../native-access-integration.md)
- [Device handoff](../device-handoff.md)
- [iOS 27 native verification](../ios-27-simulator-verification.md)
- [Existing token endpoint](https://github.com/lean-software-production/ensembleworks/blob/94b8d84df6691d3999d8e0cfa7aa37629e923c52/server/src/features/av.ts)
- [LiveKit React Native quickstart](https://docs.livekit.io/transport/sdk-platforms/react-native/)
