# Iteration 001: Join the existing room from an iPhone

## Goal

Advance the [Ensembleworks Mobile vision](../docs/vision.md) by establishing the first working phone-to-web video call in the team's shared room.

A person opens the iOS app, signs in through the existing Cloudflare Access flow, and joins the Ensembleworks room. They can see and hear teammates using the existing web app, and those teammates can see and hear them.

The deployed web app is https://canvas-ew-lsp-001.ensembleworks.dev/.

## Decisions from the interview

- Build a React Native app using LiveKit and the existing backend.
- iOS is the acceptance platform. Include Android scaffolding if the shared setup makes it straightforward; Android validation is not required for this iteration.
- Use the normal Cloudflare sign-in flow.
- Ask for a display name once and remember it locally.
- Join immediately with microphone and camera enabled, after requesting the necessary permissions. There is no pre-join media preview.
- Show everyone in a simple participant grid, including a self preview. Show names and a placeholder when a participant's camera is off.
- Play all remote participants at equal volume on the phone.
- Provide microphone and camera toggles and a Leave button.
- Development happens in the GitHub Codespace. The owner has a Mac for the iOS build and device verification.

## Existing integration

Source inspection of `lean-software-production/ensembleworks` at commit `94b8d84df6691d3999d8e0cfa7aa37629e923c52` found:

- The web client defaults to logical room `team` when the URL has no room query parameter.
- `GET /api/av/token?room=team&identity=<id>&name=<name>` returns `{ enabled: true, token, url }` when media is configured.
- The backend grants access to LiveKit room `canvas-team`. The mobile app should request logical room `team` and use the returned token and URL.
- A missing media configuration returns `{ enabled: false }`.
- The proxy configuration routes `/livekit` to the self-hosted LiveKit server and documents Cloudflare Access protection of signaling as well as the web/API routes.

These are repository findings, not verification of the deployed instance. Confirm the deployed token contract and room during the first integration step.

## Technical approach

Use Expo with TypeScript and a native development build, following the general structure of the BB mobile app. Choose mutually compatible Expo, React Native, and LiveKit versions during implementation rather than copying BB's dependency versions. Use the LiveKit React Native SDK for native media and participant rendering.

Keep the application and its setup instructions inside `ensembleworks-mobile/`. Store a mobile participant ID separately from the display name so two people with the same name can join without replacing each other. Obtain LiveKit tokens from the backend at runtime.

Cloudflare authentication is the first integration milestone. Determine a supported sign-in/session approach for the actual deployment, and verify that authenticated native HTTP requests and LiveKit WebSocket connections can both use the resulting session. Browser or WebView sign-in alone does not establish that native networking shares its cookies. Treat session expiry as a return to sign-in, with a clear explanation.

No backend change is assumed. If the existing Access configuration cannot support the native flow, document the specific required integration change before extending the implementation scope.

## Implementation sequence

1. Create the Expo application, native LiveKit configuration, permission declarations, and reproducible Codespace/Mac setup instructions.
2. Verify Cloudflare sign-in, authenticated token retrieval, and native LiveKit signaling on an iPhone against the deployed backend. Resolve this before building out the call screen.
3. Add remembered display name and mobile identity, then join the existing room with microphone and camera enabled.
4. Render participant videos, names, camera-off placeholders, and the local preview. Add microphone, camera, and Leave controls.
5. Add understandable joining, empty-room, permission-denied, and connection-failure states, with a way to retry. Release media and stop the audio session when leaving.
6. Run Codespace checks and document the Mac/iPhone acceptance run, recording any remaining device validation separately.

## Acceptance scenarios

- On first launch, sign in through Cloudflare Access and enter a display name. Join the existing room after granting camera and microphone permissions.
- With a teammate already using the web app, both participants see and hear each other. The mobile name appears to the teammate.
- With multiple teammates publishing media, the phone shows each person in the grid and hears their audio at equal volume. Web participants can use their existing full-volume audio setting during this check; phone participation does not introduce canvas position synchronization.
- Turn the mobile microphone off and on. The web participant hears the corresponding change.
- Turn the mobile camera off and on. The web participant sees the corresponding change, and the mobile self preview reflects it.
- See a named placeholder for a remote participant whose camera is disabled. Update the grid when participants join or leave.
- Leave the call. Audio and video publication stop, camera/microphone resources are released, and the app offers a way to join again.
- Relaunch the app. The display name is remembered. Reuse a valid authenticated session where supported, or request sign-in again if it has expired.
- If a permission is denied or the backend cannot be reached, show an actionable state rather than an indefinite spinner. Do not report a successful media join when media is unavailable.

## Validation and handoff

In the Codespace, run the app's type checking and other configured checks. Use focused automated coverage for token-response handling and join/authentication state transitions where practical. Mocks do not establish real iOS media or Cloudflare compatibility.

On the Mac, install the documented toolchain, generate/build the native iOS app, configure development signing, and install it on a physical iPhone. Run the acceptance scenarios against the existing web app, including one call with the phone on a different network. Include exact commands and signing steps in the implementation handoff. Expo Go is not the runtime for this native LiveKit build.

Iteration completion requires the real iPhone-to-web call to be verified. Codespace checks alone cannot establish that result.

## Deferred scope

Screen sharing, canvas editing, spatial audio, multiple-room selection, chat, recording, background/locked-screen calling, CallKit integration, App Store/TestFlight distribution, and Android acceptance testing are deferred. This iteration establishes foreground calling through the existing deployment.

## References

- [Vision](../docs/vision.md)
- [Existing token endpoint](https://github.com/lean-software-production/ensembleworks/blob/94b8d84df6691d3999d8e0cfa7aa37629e923c52/server/src/features/av.ts)
- [Web room and identity handling](https://github.com/lean-software-production/ensembleworks/blob/94b8d84df6691d3999d8e0cfa7aa37629e923c52/client/src/identity.ts)
- [LiveKit proxy configuration](https://github.com/lean-software-production/ensembleworks/blob/94b8d84df6691d3999d8e0cfa7aa37629e923c52/deploy/Caddyfile)
- [BB mobile reference](https://github.com/get-bb/bb/tree/main/apps/mobile)
- [LiveKit React Native quickstart](https://docs.livekit.io/transport/sdk-platforms/react-native/)
