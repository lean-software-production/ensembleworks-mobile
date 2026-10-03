# Iteration 001 plan

- [x] Scaffold a compatible Expo/TypeScript native LiveKit app with iOS permissions and reproducible Codespace/Mac setup instructions (not Expo Go).
- [x] Define small application ports and injected adapters for authentication/session state, token retrieval, identity storage, permissions, and room operations/events; provide deterministic test doubles and verify the HTTP token contract on Linux.
  - [x] Document deployed Access redirects, native cookie feasibility, conditional integration requirements, and physical-iPhone verification steps in `docs/native-access-integration.md`; link the report from `README.md`.
  - Scope revised: real Cloudflare login and physical-iPhone signaling verification move to iteration 002. Preserve the investigation; they no longer block iteration 001.
- [x] Persist a display name and separate mobile participant identity; orchestrate permissions and immediate camera/microphone joining through injected ports, with Linux behavior tests.
- [x] Build the participant grid with names, camera-off placeholders, self preview, equal-volume remote audio, microphone/camera toggles, and Leave/rejoin controls.
- [x] Handle joining, empty rooms, denied permissions, unavailable media, connection failures, retries, and expired sessions; release media and stop the audio session on leave.
  - [x] Centralize room cleanup and pending-cleanup ownership in `JoinApplication`; consistently report cleanup failures before authentication or rejoin, including failed-join recovery and interruption paths (validator finding).
- [x] Verify all revised iteration 001 scenarios with Linux application/component/adapter tests; run typecheck and dependency checks. Document explicitly selected, visibly labeled test-adapter mode with no silent production fallback.
- [ ] Document the iteration 002 handoff: unresolved Cloudflare adapter, Mac build/signing/install steps, authenticated contract/signaling verification, and real phone-to-web media acceptance. Distinguish modeled behavior from unverified native/deployed compatibility. Iteration 001 completion requires Linux checks and this handoff, not device verification.
