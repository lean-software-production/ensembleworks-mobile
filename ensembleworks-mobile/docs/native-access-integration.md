# Native Cloudflare Access integration gate

## Status: blocked; device verification NOT complete

The iteration 001 scope has since been revised to use ports and adapters with
Linux test doubles. The real deployment/device gate described here now belongs
to iteration 002 and does not block implementing or validating iteration 001's
application logic and call UI. The investigation below remains evidence of
unresolved production integration, not a successful native connection.

This records work on the second task of iteration 001, not a successful join.
The Codespace has no signed-in deployment session, Mac/Xcode, or physical iPhone
available for this run. No call UI or authentication workaround was added.
This investigation alone does not verify production participant media.

## Deployed evidence

Unauthenticated probes to `https://canvas-ew-lsp-001.ensembleworks.dev` returned:

| Request | Response |
| --- | --- |
| `GET /` | HTTP 302 to Cloudflare Access |
| `GET /api/av/token?room=team&identity=mobile-integration-probe&name=Integration%20probe` | HTTP 302, HTML, not token JSON |
| `GET /livekit/` | HTTP 302 to Cloudflare Access |
| HTTP/1.1 WebSocket upgrade request to `/livekit/rtc?access_token=invalid-integration-probe` | HTTP 302, not 101 |

Response server dates were 2026-10-03 18:48–18:49 UTC. The login destination
was `https://lean-software-production.cloudflareaccess.com/cdn-cgi/access/login/canvas-ew-lsp-001.ensembleworks.dev`.
These probes did not follow redirects or submit credentials. The upgrade probe
used a deliberately invalid LiveKit token: it demonstrates the unauthenticated
edge redirect only, not a valid signaling connection or the deployed SFU route.
The observed `CF_AppSession` cookie is not proof of an authenticated
`CF_Authorization` session. Redirect metadata and cookie values are intentionally
not recorded here.

Reproduce without secrets (do not add `-L`; inspect the first response):

```sh
BASE=https://canvas-ew-lsp-001.ensembleworks.dev
curl -sS --max-time 20 -D - -o /dev/null \
  "$BASE/api/av/token?room=team&identity=mobile-integration-probe&name=Integration%20probe"
curl -sS --http1.1 --max-time 20 -D - -o /dev/null \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Version: 13' \
  -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' \
  "$BASE/livekit/rtc?access_token=invalid-integration-probe"
```

Do not attach raw authenticated headers, cookies, redirect URLs, or JWTs to
factory logs. A browser login page returned as HTTP 200 after following a
redirect must never be interpreted as a successful token response.

## Contract: source confirmed, deployment still unverified

Re-read `server/src/features/av.ts` and `deploy/Caddyfile` from the seed's pinned
upstream commit `94b8d84df6691d3999d8e0cfa7aa37629e923c52`:

- Missing media configuration returns `{ enabled: false }`.
- A configured backend returns `{ enabled: true, token, url }`.
- Logical `room=team` grants `video.room=canvas-team`, with room join,
  publish, and subscribe enabled for the default member role.
- The Caddy source strips `/livekit` before proxying to the SFU; its comments
  explicitly describe Access cookie authentication as an additional layer to
  the LiveKit JWT.

The deployed JSON, configured signaling URL, token grants, and actual room have
**not** been observed. Use the runtime returned URL, not an assumed SFU hostname.
Decoding a JWT locally can inspect grants but is not signature verification;
a successful authenticated native LiveKit join must establish the real contract.

## Native session feasibility

The installed React Native 0.81.5 implementation at
`node_modules/react-native/React/CoreModules/RCTWebSocketModule.mm` loads cookies
from `NSHTTPCookieStorage.sharedHTTPCookieStorage` into the handshake. It maps
`wss` to `https` for secure-cookie lookup and documents sharing with fetch/XHR.
LiveKit client 2.22.3's `src/api/WebSocketStream.ts` constructs the global
`WebSocket(url, protocols)` without custom authentication headers. A correctly
scoped cookie in the native shared store is therefore a plausible way to
support both native HTTP and signaling without patching LiveKit.

This is source-level feasibility, **not iPhone proof**. Safari/system browser
sign-in does not establish that the session appears in that store. A WKWebView
has its own cookie store; merely displaying the login page, reading
`document.cookie` (which omits HttpOnly cookies), or setting fetch credentials
is not a cookie-transfer implementation.

Candidate to validate with the deployment owner: normal Access login in an
embedded WKWebView, followed by an explicit native transfer of the authenticated
cookie from WKHTTPCookieStore into shared NSHTTPCookieStorage. Preserve Secure,
HttpOnly, domain, path, and expiry, restrict transfer to the approved deployment
host, and verify the actual returned signaling host is covered. The deployment's
identity provider may prohibit embedded login; this candidate is not yet selected
as a supported production flow. Do not install dependencies or claim support
until that policy and the iPhone transport checks are resolved for the production
sign-in adapter. Test-adapter UI development can proceed independently.

## Owner action / required integration decision if blocked

First supply a Mac/physical iPhone and an authorized human who can complete the
normal Access login; no service-token secret should be embedded in the app.
Ask the Access administrator to confirm the identity provider's embedded-browser
policy, Access application domains/cookie scope, session duration, and whether
the token endpoint and runtime signaling URL share an applicable session.

No backend change is proven necessary by the unauthenticated 302 alone. If the
provider rejects embedded login or cookies cannot be transferred reliably, the
specific integration gap is a **supported handoff from normal browser Access
login to a native session usable by both token HTTP and signaling**, not a
missing LiveKit token. Before expanding scope, agree an owner-approved design:

- An authenticated server-side handoff can issue a short-lived, one-use code
  bound to a native app challenge and approved callback. Redeem it over TLS for
  a native session. Do not put Access cookies or LiveKit JWTs in callback URLs.
- The Access edge/proxy must explicitly accept that native session for both
  `/api/av/token` and the returned signaling route. A backend-only bearer token
  behind the unchanged Access gate will still be redirected.
- Alternatively the owner can approve a dedicated mobile signaling route gated
  by valid short-lived LiveKit grants, while token minting remains authenticated
  through an approved native handoff. This is an infrastructure/security change,
  not permission to expose arbitrary backend routes or disable Access globally.

These are conditional integration requirements, not implemented changes or
claims that the existing deployment supports them. Return to the owner before
implementing a broker or changing Access policy.

## Physical-iPhone exit criteria for this same task

Use the README's Mac signing/install steps, then an integration-only harness
(no grid or media publication required):

1. Complete normal Access sign-in. Record device/iOS, build versions, login
   mechanism, and approved cookie/session transport, without credential values.
2. Fetch the token endpoint using **native fetch**, not WebView JavaScript, with
   logical room `team` and a fresh mobile probe identity. Require HTTP success
   and JSON; check `enabled`, a nonempty token and URL. `enabled:false` is a
   media-unavailable blocker, never success.
3. Inspect grants locally for `canvas-team`, identity, name, join/publish/subscribe
   rights and expiry. Record only these non-secret conclusions, not the JWT.
4. Connect a native LiveKit `Room` using the returned token/URL, initially without
   publishing. Record connected state and `room.name === 'canvas-team'`; observe
   a web teammate in the same room. Disconnect the probe after verification.
   HTTP success alone does not establish WebSocket authentication.
5. Terminate/relaunch and repeat native HTTP and signaling while the session is
   valid. Expire/revoke the session and test again: show a clear sign-in-required
   outcome, stop retries, and clear unusable session data. A still-connected
   socket is not proof that a fresh handshake works after expiry.
6. Repeat on cellular/different network. Record failures separately (Access
   redirect, JSON/media configuration, signaling failure, network reachability).

Remaining: all six device checks, actual login/cookie bridge implementation,
authenticated deployed contract, and native signaling. Keep the parent task
unchecked in iteration 002 until the planner has real-device evidence. `npm run check` passed
(typecheck and Expo dependency compatibility) during this investigation; it
cannot validate Cloudflare sessions or iOS WebSockets.
