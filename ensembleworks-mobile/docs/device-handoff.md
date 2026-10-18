# Device handoff — iteration 005 Pixel and pending iOS work

## Android status and Pixel prerequisites

Iteration 004 factory evidence and checklist delivery are complete; the iteration
itself is **not complete** until the owner records the
[Android checklist](iteration-004-owner-acceptance.md). See the
[Linux factory report](iteration-004-factory-validation.md) for exact evidence,
fallback/dependency decisions and limitations. No real authenticated call is
claimed. Iteration 003 iOS owner work below stays pending for the next Mac session.

For iteration 005, use a recent-release ARM64 Pixel, a data-capable USB cable,
Developer options enabled (tap Build number seven times), and USB debugging
turned on. The owner unlocks the phone and approves this host's debugging prompt.
Use the Flox-provided fallback SDK's `adb`; no Android Studio or system SDK is
needed. Run `flox activate -d .. -- adb devices -l` to check connection.
If Linux reports insufficient permissions, the owner must install/configure
appropriate Android udev rules (on Arch, review `android-udev`), reload rules
and reconnect; check the device-node group/access instead of running adb as root.
No phone/udev configuration or USB authorization was performed by the factory.
Do not record device identifiers or inspect authenticated device traffic.

The retained production APK **with the JNI keep-rule fix** is:
`~/.local/share/ensembleworks-mobile/artifacts/iteration-004/production-arm64-jni-release.apk`.
SHA-256: `11ed1f7990c28f72dc9b3dbba46049b18499f5b723e99e603c5dd1f3bbcfff42`.
It contains 18 ARM64 native libraries, an embedded JS bundle, and verified Android
Debug signing. It needs no Metro. Do not substitute task 2's older
`production-arm64-release.apk` (missing the fix) or the x86_64 emulator APKs.

With only the intended phone connected, sideload and launch:

```sh
flox activate -d .. -- sha256sum "$HOME/.local/share/ensembleworks-mobile/artifacts/iteration-004/production-arm64-jni-release.apk"
flox activate -d .. -- adb -d install -r "$HOME/.local/share/ensembleworks-mobile/artifacts/iteration-004/production-arm64-jni-release.apk"
flox activate -d .. -- adb -d shell am start -n dev.ensembleworks.mobile/.MainActivity
```

Compare the checksum before installing. A signing mismatch requires an explicit
owner decision before uninstalling (which destroys local session/name state).
Debug release sideloading is not production signing or Play Store distribution.

Repeat all nine Android owner checks on the Pixel, including permissions,
authenticated session reuse/revocation, actual room, bidirectional media,
mic/camera toggles and leave/rejoin. Record phone/OS version and non-secret
observations. Emulator results do **not** establish phone camera/microphone or
audio routing, hardware video encoding, background/locked-screen behavior,
battery use or calls on cellular/another network. These remain physical-device
or later scoped checks, not passes. No phone was provisioned or executed here.

Cross-platform findings: shared Expo/RN freshness upgrades require the next Mac
regression run; no fresh iOS build is claimed. Android's JNI keep plugin is
Android-only. Native cookie transport feasibility is not authenticated proof
on either platform; see [source trace](android-native-session-transport.md).

## Historical iOS handoff

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

## Physical iPhone prerequisites (preserved, not iteration 004 scope)

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
or locked if that is in scope for the release. These iPhone checks remain
separate from iteration 004 Android emulator work and iteration 005 Pixel work.
