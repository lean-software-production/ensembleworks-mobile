# Verification

Checked on 2026-10-13 for terminal rendering and keyboard control regressions.

| Check | Command | Outcome |
| --- | --- | --- |
| Terminal regression suite | `npm test` | Passed: 9 tests, 0 failures. |
| Fragmented and coalesced arrow decoding | Included in `npm test` (`decodes fragmented arrow keys and coalesced movement keys in order`) | Passed. |
| Input buffering and Escape-followed input | Included in `npm test` (render-before-buffering plus Escape followed by quit, Ctrl-C, and movement in separate and coalesced chunks) | Passed. |
| Rendering, lifecycle cleanup, and gravity | Included in `npm test` (clear-line rendering, start/stop restoration, and gravity behavior) | Passed. |

No interactive `npm start` session was performed for this verification task. The checks above use the automated terminal test doubles rather than a manually observed terminal.
