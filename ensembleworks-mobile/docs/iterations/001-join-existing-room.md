# Iteration 001: Build a testable shared-room calling app

## Goal

Advance the [ensembleWorks Mobile vision](../docs/vision.md) by building the shared-room calling experience with application behavior that can be verified in the Linux Codespace through ports and adapters.

The intended production experience is that a person signs in through Cloudflare Access and joins the ensembleWorks room from an iPhone, seeing and hearing web teammates. This iteration implements and tests the application flow and UI using explicit test doubles for external services and native capabilities. Iteration 002 will establish real sign-in, native media compatibility, and a physical phone-to-web call.

The deployed web app is https://canvas-ew-lsp-001.ensembleworks.dev/.

## Decisions from the interview

- Build a React Native app using LiveKit and the existing backend.
- iOS is the first production platform. Linux automated tests are the acceptance environment for iteration 001. Include Android scaffolding if straightforward.
- Use the normal Cloudflare sign-in flow.
- Ask for a display name once and remember it locally.
- Join immediately with microphone and camera enabled, after requesting the necessary permissions. There is no pre-join media preview.
- Show everyone in a simple participant grid, including a self preview. Show names and a placeholder when a participant's camera is off.
- Play all remote participants at equal volume on the phone.
- Provide microphone and camera toggles and a Leave button.
- Development and iteration 001 acceptance happen in the Linux GitHub Codespace. The owner has a Mac for iteration 002's iOS build and device verification.

## Existing integration

Source inspection of `lean-software-production/ensembleworks` at commit `94b8d84df6691d3999d8e0cfa7aa37629e923c52` found:

- The web client defaults to logical room `team` when the URL has no room query parameter.
- `GET /api/av/token?room=team&identity=<id>&name=<name>` returns `{ enabled: true, token, url }` when media is configured.
- The backend grants access to LiveKit room `canvas-team`. The mobile app should request logical room `team` and use the returned token and URL.
- A missing media configuration returns `{ enabled: false }`.
- The proxy configuration routes `/livekit` to the self-hosted LiveKit server and documents Cloudflare Access protection of signaling as well as the web/API routes.

These are repository findings, not verification of the authenticated deployed instance. Use them to define the token adapter's expected contract now; confirm the deployed contract and room in iteration 002. The existing [native Access investigation](../docs/native-access-integration.md) records the remaining integration questions.

## Technical approach

Use Expo with TypeScript and a native development build, following the general structure of the BB mobile app. Choose mutually compatible Expo, React Native, and LiveKit versions during implementation rather than copying BB's dependency versions. Use the LiveKit React Native SDK for native media and participant rendering.

Keep the application and its setup instructions inside `ensembleworks-mobile/`. Store a mobile participant ID separately from the display name so two people with the same name can join without replacing each other. Obtain LiveKit tokens from the backend at runtime.

Keep application orchestration independent of React Native, Cloudflare, and LiveKit. Define small ports for authentication/session state, token retrieval, identity persistence, media permissions, and room operations/events. Inject adapters at the application entry point; do not introduce a generic framework or unnecessary abstraction layers.

Supply deterministic in-memory test adapters that can simulate successful sign-in, expiry, denied permissions, token errors, participant events, connection failure, and cleanup. Test observable behavior through these ports. Use React Native component tests for the call screen, substituting native video rendering where Linux cannot execute it.

Implement the HTTP token adapter against an injected transport and exercise actual response parsing with fixtures for success, disabled media, Access redirects/login HTML, malformed JSON, and network failure. Implement the LiveKit room adapter against an injected SDK boundary where feasible, testing operation/event mappings through an SDK double. Native permission and storage adapters can be implemented behind the same ports and checked with native-module doubles. Their device behavior remains unverified.

Keep Cloudflare's production sign-in adapter explicitly unresolved until the device integration is established. Provide an explicitly selected development/demo composition using test adapters so the UI can be exercised without Access credentials or native media. Test-adapter mode must be visible and must not silently activate after a production connection fails. A fake session must never be sent to the deployed backend.

Iteration 002 must establish a supported Cloudflare session handoff and verify both native HTTP and LiveKit signaling. Browser or WebView sign-in alone does not establish cookie sharing. Treat session expiry as a return to sign-in.

No backend change is assumed. If the existing Access configuration cannot support the native flow, document the specific required integration change before extending the implementation scope.

## Implementation sequence

1. Create the Expo application, native LiveKit configuration, permission declarations, and reproducible Codespace/Mac setup instructions.
2. Define the application ports, injected composition, deterministic test adapters, and tested HTTP token contract. Record unresolved native authentication work for iteration 002; device verification does not gate the call UI in this iteration.
3. Add remembered display name and mobile identity, permission handling, and immediate join orchestration through the ports.
4. Render participant videos, names, camera-off placeholders, and the local preview. Add microphone, camera, and Leave controls.
5. Add understandable joining, empty-room, permission-denied, and connection-failure states, with a way to retry. Release media and stop the audio session when leaving.
6. Run the Linux behavior/component/adapter checks, document how to exercise test-adapter mode, and hand off the real-device acceptance checklist for iteration 002.

## Acceptance scenarios

Run these scenarios with injected test adapters and observable UI/application assertions on Linux. Video tiles use test representations; no scenario claims actual camera capture, audio playback, or network media delivery.

- On first launch, exercise the authentication port's simulated sign-in and enter a display name. Assert the room port joins logical room `team` using token-service results after simulated camera and microphone permission grants.
- With a simulated teammate already in the room, show their video tile and the local preview. Assert the join request uses the saved name and a separate participant ID, subscribes to remote media, and enables local microphone/camera after permission is granted.
- With multiple simulated teammates, show each in the grid and apply equal remote audio gain. The phone does not require canvas position synchronization.
- Turn the microphone off and on. Assert the room adapter receives the corresponding publication operations and the control state updates.
- Turn the camera off and on. Assert the room adapter receives the corresponding publication operations and the self-preview state updates.
- See a named placeholder for a remote participant whose camera is disabled. Update the grid when participants join or leave.
- Leave the call. Assert disconnection, media/audio-session cleanup and event unsubscription through the adapter boundary, and offer a way to join again. Late events from a previous call must not restore its UI.
- Relaunch the app. The display name is remembered. Reuse a valid authenticated session where supported, or request sign-in again if it has expired.
- If a permission is denied or the backend cannot be reached, show an actionable state rather than an indefinite spinner. Do not report a successful media join when media is unavailable.

## Validation and handoff

Iteration 001 is complete when the Linux automated suite verifies the acceptance scenarios, component behavior, and adapter contracts; type checking and dependency checks pass; and setup/demo instructions and the iteration 002 handoff are documented. All tests must run without live credentials, macOS, an iPhone, or a running LiveKit server. Do not substitute blanket SDK mocks for tests of the application decisions and adapter mappings.

Test doubles establish the application's behavior under the modeled contracts. They do not establish real iOS media, Cloudflare login, cookie sharing, WebSocket authentication, or deployed compatibility. Record that distinction in the handoff.

For iteration 002, use the Mac to build/install the app on a physical iPhone and complete the supported Cloudflare authentication adapter. Verify authenticated token retrieval and native signaling first, then real two-way audio/video against web teammates, multiple participants, controls, cleanup, relaunch/expiry, and a different-network call. Include commands and signing steps in the handoff. Expo Go is not the runtime for this native LiveKit build.

The first iteration can finish on Linux. The product's first real iPhone-to-web call remains the completion requirement for iteration 002.

## Deferred scope

Real Cloudflare login/session transport and physical iPhone-to-web verification move to iteration 002. Screen sharing, canvas editing, spatial audio, multiple-room selection, chat, recording, background/locked-screen calling, CallKit integration, App Store/TestFlight distribution, and Android acceptance testing remain deferred.

## References

- [Vision](../docs/vision.md)
- [Existing token endpoint](https://github.com/lean-software-production/ensembleworks/blob/94b8d84df6691d3999d8e0cfa7aa37629e923c52/server/src/features/av.ts)
- [Web room and identity handling](https://github.com/lean-software-production/ensembleworks/blob/94b8d84df6691d3999d8e0cfa7aa37629e923c52/client/src/identity.ts)
- [LiveKit proxy configuration](https://github.com/lean-software-production/ensembleworks/blob/94b8d84df6691d3999d8e0cfa7aa37629e923c52/deploy/Caddyfile)
- [BB mobile reference](https://github.com/get-bb/bb/tree/main/apps/mobile)
- [LiveKit React Native quickstart](https://docs.livekit.io/transport/sdk-platforms/react-native/)
