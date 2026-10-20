# Android native session transport — task 4

## Result and scope

Credential-free source/test investigation on this Linux host supports feasibility,
not deployed authenticated success. No demonstrated Android cookie-sharing defect;
no cookie bridge, flush plugin, native change or dependency change is justified.
No sign-in, network authentication probe or inspection of an owner AVD occurred.

Versions inspected in installed sources match package pins: React Native 0.88.0,
react-native-webview 14.0.1, @livekit/react-native 3.0.0,
@livekit/react-native-webrtc 144.2.0 and livekit-client 2.22.3.
The prior freshness hold is resolved by the replacement owner authorization
recorded in `android-release-build.md`; this task changes no pins.

## Source trace (paths relative to repository)

1. `src/components/AccessSignIn.tsx` loads only the configured HTTPS origin into
   WebView. Navigation/load callbacks request `completeSignIn()`; a WebView page
   completion is not itself session confirmation. `sharedCookiesEnabled` is the
   Apple HTTPCookieStorage prop, not Android's sharing mechanism:
   `node_modules/react-native-webview/src/WebViewTypes.ts:560–565` marks it iOS
   (a separate macOS declaration exists).
2. Android WebView uses `android.webkit.CookieManager`.
   `node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebViewClient.java:50–55`
   already flushes that manager in `onPageFinished`, before emitting completion.
   No page JavaScript cookie extraction is needed or added.
3. `App.tsx` supplies `NativeCookieTransport` to both authentication and token
   retrieval. `src/adapters/cloudflareAccess.ts` calls native fetch with
   `credentials: 'include', redirect: 'manual'`. Its existing iOS-specific comment
   describes the Apple path; Android instead uses the following native path.
   Under `node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/modules/network/`,
   `NetworkingModule.kt:186` installs `JavaNetCookieJar(cookieHandler)`;
   `:383–385` disables cookies only without credentials.
   `ForwardingCookieHandler.kt:28–35` obtains cookies for the URI from the singleton
   WebView CookieManager; `:54–62` writes response cookies and flushes. This keeps
   cookie contents and security/scope decisions native, not in app JS or storage.
4. Native HTTP success is checked separately: `CloudflareAccessAuthentication`
   checks the configured origin, rejecting redirects/401/403 and treating network
   failures as unavailable, not proof of expiry. The persisted host-keyed marker
   is not a credential; restoration rechecks HTTP. `HttpTokenAdapter` additionally
   rejects login HTML, redirects and invalid responses, invokes session expiry,
   and accepts the returned secure signaling URL unchanged. Neither native HTTP
   confirmation nor token retrieval establishes signaling authentication.
5. `src/adapters/liveKitRoom.ts` passes returned URL/token to SDK `Room.connect`.
   `node_modules/livekit-client/src/room/RTCEngine.ts:370` calls SignalClient join;
   `src/api/SignalClient.ts:442,508` constructs the RTC endpoint and opens
   `WebSocketStream`; `src/api/WebSocketStream.ts:53` uses global WebSocket.
   `index.ts` registers LiveKit globals, but neither
   `node_modules/@livekit/react-native/src/index.tsx` nor WebRTC's
   `src/index.ts` registerGlobals replaces WebSocket. It remains React Native's.
6. In `node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/modules/websocket/WebSocketModule.kt`,
   `:58` owns ForwardingCookieHandler, `:123–125` supplies its cookie to the
   handshake and `:428–436` queries the manager. `:468–490` maps wss to https.
   **Caveat:** lookup uses the origin, not the full signaling path. A root-scoped
   Access cookie can work; a cookie restricted to `/livekit` may not be selected.
   No deployed cookie attributes were inspected. Native CookieManager restricts
   selection by destination host; the app does not copy cookies to a returned
   cross-host signaling URL. A different host therefore requires its own valid
   cookie scope/session. Do not broaden scope or rewrite returned URLs speculatively.

## Security and remaining owner checks

No cookie values, headers, credentials or real tokens were read or recorded.
The app adds no Access cookie/token to URLs and exposes no cookie API to JS.
LiveKit's existing protocol internally places its room token in the signaling
request; do not capture that request URL. Its inspected connection log uses
`redactedUrl` with the room-token field replaced (`SignalClient.ts:489–504`).
Source review is not a guarantee about every future SDK diagnostic: do not retain
raw authenticated traffic/logcat or enable verbose authenticated logging.

Owner verification still needs normal Access sign-in, native HTTP confirmation,
actual signaling join, relaunch session reuse and revocation recovery. If HTTP
works but signaling fails, record only the failing stage/status; the owner must
establish cookie host/path scope and upgrade policy without supplying secrets.
A proven origin/path mismatch would require an owner-approved supported transport
or deployment policy resolution, not a speculative bridge or backend/Access edit.
Existing session reuse/expiry, host restriction, production-no-demo fallback and
returned signaling URL behavior are unchanged. iOS remains unexecuted on Linux.

## Verification performed

Every invocation used `flox activate -d .. --` without a login shell:

- `node --version`: v24.21.0.
- `timeout 120 npx tsx --test tests/cloudflareAccess.test.ts tests/adapters.test.ts tests/nativeAdapters.test.ts`:
  exit 0. Existing tests distinguish native confirmation from WebView completion,
  session restoration/expiry, token HTTP from room connection, secure returned
  URL forwarding, production-no-demo fallback and error redaction. New test
  verifies both HTTP uses delegate opaque cookie handling to fetch with included
  credentials/manual redirects, restore the global stub, and add no headers.
- After the final test change, `timeout 300 npm test`: exit 0, 67 application tests
  plus 18 component tests in seven suites (85 total); no earlier assertions removed.
- `timeout 300 npm run check`: exit 0, TypeScript and Expo dependency check pass.
  Existing Jest exclusions are unchanged; no new suppression.
- `timeout 300 npx expo-doctor`: exit 0, 20/20 checks pass.

Full local credential-free output: `/tmp/ew-task4-{focused,test,check,doctor}.log`.
Flox prints its signed-out notice; no login was attempted. Tests print a Watchman
recrawl warning but pass. Only tests/documentation changed, so prior clean-release
and both launch evidence in `android-emulator-launch.md` are unaffected, not rerun
or newly claimed. No build, Metro, emulator or simulator was started by this task.
