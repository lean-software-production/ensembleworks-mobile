# Iteration 003 owner acceptance checklist

## Status

**Factory implementation and credential-free validation are complete; iteration 003 is not complete until the owner performs and records the checks below.** All owner checks are **not attempted** as of 8 October 2026. The factory did not request, enter, retain, or inspect credentials.

Use the iOS 27 simulator with a web teammate already joined at the deployed application. Use headphones to avoid feedback. The simulator has no camera; its microphone input is the Mac's input. Do not record cookies, raw authenticated headers, JWTs, token-bearing URLs, or credentials in this document, screenshots, console output, or issue reports.

## Test record

Record the build revision, simulator/iOS version, macOS/Xcode version, deployment host, date, and web teammate/network context here before testing. Record only non-secret observations.

| Field | Value |
| --- | --- |
| Revision/build | Not recorded |
| Simulator and iOS version | Not recorded |
| macOS and Xcode version | Not recorded |
| Deployment host | Not recorded |
| Web teammate and network context | Not recorded |
| Test date and owner | Not recorded |

## Acceptance checks

Mark each item **Passed**, **Failed**, or **Not attempted**. Attach only redacted/non-secret screenshots where useful.

| Check | Procedure and required non-secret observation | Status | Evidence / notes |
| --- | --- | --- | --- |
| In-app Access sign-in | Launch the production-mode simulator build and choose the Access sign-in action. Complete the normal GitHub login in the in-app page. Confirm the app reports an authenticated session; it must not switch to or label itself as demo mode. | Not attempted | — |
| Room identity and token integration | Enter a display name if prompted and join. Confirm the integration view reports authenticated, logical room `team`, actual room `canvas-team`, and a connected state. Do not capture the token or signaling URL. | Not attempted | — |
| Incoming web participant video | With a web teammate publishing video in the deployed room, confirm their named tile/video appears in the simulator grid. | Not attempted | — |
| Bidirectional audio | Grant microphone permission, speak into the Mac microphone, and confirm the web teammate hears the mobile participant. Confirm the simulator hears the web teammate through the selected Mac audio output. | Not attempted | — |
| Camera unavailable is truthful | While joined, confirm the app shows camera off/unavailable and explains that the simulator cannot provide a camera. Confirm the call remains connected and does not claim camera is enabled. | Not attempted | — |
| Microphone toggle | Toggle microphone off and confirm the web teammate no longer hears the participant. Toggle it on and confirm audio resumes without leaving the room. | Not attempted | — |
| Leave and rejoin | Leave the call and confirm the web teammate sees the departure. Rejoin and confirm the participant, audio, and web teammate connection return. | Not attempted | — |
| Relaunch session reuse | Quit and relaunch while the Access session remains valid. Confirm the saved name is reused and joining does not require another Access login. | Not attempted | — |
| Revoked-session recovery | Revoke the session through Cloudflare Access, then attempt a fresh join/relaunch. Confirm the app clears the unusable session and returns to the Access sign-in action without spinning, retrying indefinitely, or falling back to demo mode. | Not attempted | — |

## If authentication or signaling is blocked

Do not change the backend or Access configuration during this iteration. Record the affected checklist row as **Failed** and add a short, non-secret observation below (for example: native confirmation remained redirected after normal login, or the runtime signaling host was not covered by the native session).

Then record the exact owner-approved change required before further implementation. The required change must provide a supported native session handoff usable by both native `GET /api/av/token` and the runtime signaling host, without placing an Access cookie or LiveKit token in a URL. If the identity provider disallows embedded login or shared/native cookie transport cannot establish that session, the owner must approve one of:

- a TLS-protected, short-lived, one-use native handoff code bound to an app challenge and redeemed for a native session accepted by Access for both routes; or
- a dedicated mobile signaling route that accepts short-lived LiveKit grants while authenticated token minting remains behind an approved native handoff.

These are required infrastructure/Access decisions if blocked, not changes implemented or authorized by this checklist.

| Blocker area | Non-secret observation | Exact required owner-approved change | Status |
| --- | --- | --- | --- |
| Authentication / signaling | Not attempted | Not determined | Not attempted |

## Completion decision

The factory validation in [iteration 003 factory validation](iteration-003-factory-validation.md) verifies credential-free automated checks and the unattended production sign-in entry point only. It does not pass any row above. Mark iteration 003 complete only after the owner has completed this checklist and recorded its results.
