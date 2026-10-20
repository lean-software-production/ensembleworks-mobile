# Iteration 004 — Android owner acceptance

Factory launch verification is not a real call. The owner ran a first, partial
session on 2026-10-18 (see [Owner session notes](#owner-session-2026-10-18)).
**Iteration 004 is not accepted:** the microphone failed and the mobile
participant was not visible on the desktop side.
Iteration 003's [iOS checklist](iteration-003-owner-acceptance.md) remains pending
for the next Mac session, independently of Android.

## Prepare

Use the [Linux README setup](../README.md#android-on-the-owners-linux-host),
a production APK, the scripted **windowed** emulator, headphones, and a web
teammate already in the room at https://canvas-ew-lsp-001.ensembleworks.dev/.
Install the production x86_64 APK from the [launch report](android-emulator-launch.md),
not the ARM64 Pixel APK. Do not run the automated launch check after owner login:
it clears app state. Once signed in, this AVD is owner-only; agents must not
inspect it, its storage, screenshots or network traffic. Future factory runs
need a fresh credential-free AVD, not access to the owner's session.

```sh
flox activate -d .. -- bash scripts/android-emulator.sh windowed
# In another terminal, before sign-in:
flox activate -d .. -- adb -s emulator-5580 install -r "$HOME/.local/share/ensembleworks-mobile/artifacts/iteration-004/launch/production-x86_64-release.apk"
flox activate -d .. -- adb -s emulator-5580 shell am start -n dev.ensembleworks.mobile/.MainActivity
```

Default emulator limit is 1800 seconds; set `EW_EMULATOR_SECONDS=3600` through
`env` inside the Flox invocation for longer owner sessions. Stop it when finished.
Windowed execution and actual media are not factory-verified. PulseAudio
initialization failed in headless evidence: if audio is absent, record failure,
not a pass inferred from configuration. Do not weaken Access or change backend
configuration to complete a check.

## Record results

Replace status with **passed**, **failed**, or **not attempted**, and add non-secret
observations. Optional screenshots must exclude login pages, credentials,
cookies, tokens, authenticated headers and token-bearing URLs. Never export
raw authenticated logs. Only the owner performs sign-in and session revocation.

| Check | Status | Observations / optional safe screenshot |
| --- | --- | --- |
| In-app Access/GitHub sign-in; enter display name once; grant microphone/camera permissions; join | passed | Signed in and joined the room in the windowed emulator. |
| Integration view: authenticated session, logical room `team`, actual room `canvas-team` | not attempted | — |
| Web teammate's name/video appears in grid; their audio is heard through host output | partial | The browser participant appeared in the mobile app. Their video and audio were not checked. Both sides used the same GitHub account. |
| Teammate sees host-webcam mobile video and hears host microphone | failed | The host webcam worked in the emulator, but the mobile participant never appeared in the desktop app. The microphone did not work in the emulator; the same host microphone worked in the desktop app. |
| Microphone off/on stops/restores audio heard by teammate | not attempted | — |
| Camera off/on stops/restores video seen by teammate | not attempted | — |
| Leave disconnects and teammate sees departure; rejoin works | not attempted | — |
| Close/relaunch remembers name and reuses session without sign-in | not attempted | — |
| Owner revokes session in Cloudflare; next join returns to sign-in, without spinning or demo fallback | not attempted | — |

If normal login cannot confirm native HTTP or signaling remains unauthorized,
stop and record only the non-secret symptom. Source feasibility in
[the transport trace](android-native-session-transport.md) does not establish
successful deployed authentication. Record the specific owner-approved resolution
needed; do not copy session material or implement an unapproved workaround.

## Owner session 2026-10-18

The owner ran out of time after the first few checks. Unlisted checks are still
not attempted.

- **Camera:** the host webcam worked in the emulator.
- **Microphone:** did not work in the emulator. It worked in the desktop app on
  the same computer, so the host microphone is fine. This matches the
  PulseAudio initialization failure from the factory's headless runs.
- **Presence is one-sided:** a second browser joined with the same GitHub
  account. The mobile app showed that browser participant joining, but the
  desktop app never showed the mobile participant. Using one account on both
  sides may cause this (for example, two participants with the same identity),
  so it may not be a mobile defect.

Follow-ups for the next run:

1. Make emulator audio input work, or confirm it can't be done on this host,
   before re-running the microphone checks.
2. Re-run the presence check with a teammate on a different GitHub account. If
   the desktop app still doesn't show the mobile participant, investigate the
   mobile app's track publishing or participant identity.

See [Pixel handoff](device-handoff.md) for iteration 005 and emulator limitations.
