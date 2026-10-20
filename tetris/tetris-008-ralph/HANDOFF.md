# Handoff

B11/T11 recovered input/session work retained. `src/input.js` now consumes ESC intermediate bytes (20–2F) through their final byte (30–7E), across chunks, without dispatching embedded q/p/r. Existing CSI/SS3 and OSC/DCS/SOS/PM/APC suppression remains intact with constant-size state.

`test/input.test.js` covers packed, every two-chunk split and bytewise ESC intermediate sequences, working ordinary keys afterward, and production-adapter game/timer/raw/listener preservation. Existing legal soft-drop stacking reaches game over and restart without state edits. Arrows, p pause/resume, r restart, q/Ctrl-C quit remain advertised; no hard drop.

Verification: `node --test test/input.test.js` passed 4/4; final `npm test` passed 48/48 including bounded non-TTY actual launch and palette/frame regressions. Actual `npm start` Python PTY at 24x80 ignored packed/split ESC ( q and ESC # p, then accepted arrows/pause/resume/quit; exit 0, cursor restored, exact termios equality (6155 bytes). `VERIFICATION.md` maps R01–R11 evidence.

No observed plan defects. Prior target work and unrelated workspace changes preserved. No commits or downstream validation performed.

Remaining T12: dimension/resize handling and signal/handled-failure cleanup. Remaining T13: legal production clear/score lifecycle, documentation and interactive seven-colour evidence. Current controls require 60 columns; dimension enforcement remains unimplemented.
