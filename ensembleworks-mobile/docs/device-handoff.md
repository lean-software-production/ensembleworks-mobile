# Device handoff and iteration 004 preparation

## Status

Iteration 003's factory implementation and credential-free validation are complete,
but iteration 003 itself is **not complete**. The owner must run and record the
[simulator acceptance checklist](iteration-003-owner-acceptance.md). No owner
credentials were requested, entered, stored, or inspected by the factory.

The simulator has no camera. Its microphone is the Mac input. Simulator results
do not establish camera capture, signed physical-device installation, background
or locked-screen behavior, or calls across different networks.

## What the factory established

- Production builds use `EXPO_PUBLIC_DEPLOYMENT_URL` and show an in-app Access
  sign-in entry point; demo remains explicitly selected and labeled.
- The production composition uses the Access session, native authenticated token
  transport, returned LiveKit signaling URL, native audio, and participant video
  adapters. An Access redirect or login HTML expires the session rather than
  falling back to demo.
- The iOS 27 simulator launch check built, installed, launched, and kept both
  demo and production embedded-JavaScript builds alive for 20 seconds. The
  production screenshot is pre-authentication only.

See [factory validation](iteration-003-factory-validation.md) and [iOS simulator
verification](ios-27-simulator-verification.md). These are not owner acceptance
results and do not prove Cloudflare cookie sharing, authenticated token retrieval,
LiveKit signaling, or media with the deployed room.

## Owner: finish iteration 003 in the simulator

Use the production simulator build, a web teammate already in the deployed room,
and headphones. Complete the [owner checklist](iteration-003-owner-acceptance.md).
Record only non-secret observations. Do not put credentials, cookies, raw
authenticated headers, JWTs, tokens, or token-bearing URLs in notes, screenshots,
logs, or commits.

If native confirmation remains redirected after normal login, or the returned
signaling host is not covered by the native session, stop. Record the non-secret
observation and the exact owner-approved Access/backend change required; do not
weaken Access or implement a workaround in the app.

## Iteration 004 prerequisites: physical iPhone

1. A physical iPhone supported by the selected Xcode version.
2. A free Apple ID added in **Xcode → Settings → Accounts** and a USB connection
   to the Mac. Unlock/trust the phone and enable Developer Mode when iOS asks.
3. Xcode 27 (or a compatible later Xcode), its Command Line Tools, and the
   repository-root flox environment. From `ensembleworks-mobile/`, run commands
   without a login shell:

   ```sh
   flox activate -d .. -- npm ci
   flox activate -d .. -- npm run check
   flox activate -d .. -- npx expo prebuild --clean --platform ios
   flox activate -d .. -- pod install --project-directory=ios
   ```

   Open `ios/ensembleWorksMobile.xcworkspace`, not the `.xcodeproj`.
4. In the `ensembleWorksMobile` target, enable **Automatically manage signing**
   and select the personal team. A free personal team has development provisioning
   that expires after seven days; rebuild/reinstall after expiry. If
   `dev.ensembleworks.mobile` is unavailable, set a unique reverse-domain
   `ios.bundleIdentifier` in `app.json`, regenerate, and select the team. Do not
   commit signing material.
5. Supply the public deployment URL at build time; never put owner credentials
   in source, `.env` files, shell history, logs, or screenshots. Start Metro on
   the Mac only when the development client needs it.

## Remaining physical-device checks

After the simulator owner checklist is recorded, verify on the iPhone: signed
install and launch; real camera capture and outgoing video; microphone and remote
audio; native Access-session reuse and revocation recovery; leave/rejoin; and a
fresh call on cellular or another network. Also record behavior when backgrounded
or locked if that is in scope for the release. Android remains out of scope.
