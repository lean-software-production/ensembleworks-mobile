# Iteration 001 plan

- [x] Scaffold a compatible Expo/TypeScript native LiveKit app with iOS permissions and reproducible Codespace/Mac setup instructions (not Expo Go).
- [ ] Verify the deployed token contract and logical room `team`; establish Cloudflare sign-in/session support for native HTTP and LiveKit WebSocket signaling on a real iPhone before expanding the call UI. Document any required integration change if blocked.
- [ ] Persist a display name and separate mobile participant identity; request permissions and join using runtime backend tokens with camera and microphone enabled.
- [ ] Build the participant grid with names, camera-off placeholders, self preview, equal-volume remote audio, microphone/camera toggles, and Leave/rejoin controls.
- [ ] Handle joining, empty rooms, denied permissions, unavailable media, connection failures, retries, and expired sessions; release media and stop the audio session on leave.
- [ ] Add focused token/auth/join-state tests, run Codespace checks, and document exact Mac build, signing, and physical-iPhone installation steps.
- [ ] Verify and record all acceptance scenarios on a physical iPhone against web teammates, including a different-network call, multiple participants, toggles, participant updates, leave cleanup, and relaunch/session behavior. Keep iteration incomplete until real iPhone-to-web media is verified.
