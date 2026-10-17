# Frozen acceptance — Tetris 007 experiments

Every original acceptance clause in inputs/plan.md is required; preserve all 13 parent task names and boundaries. The seed adds retro ANSI colours before planning. Plan revisions may clarify contracts, never remove checks.

For each completed trial: all plan checkboxes complete; model plan-review checkpoint accepted; npm test passes after final changes; actual npm start in a 24-row PTY accepts arrow input, pause/resume, and quit without Enter, exits successfully and restores termios; non-interactive npm --silent start exits with at most 24 visible rows and has several ANSI colours. Verify final documentation includes rules, bindings and honest limitations. The implementation validator must independently check task acceptance, including the controllable fall → lock → clear/score → game over → restart → quit regression. Record validator evidence separately from external checks.

External launch checks do not independently establish every gameplay contract. A trial verdict is eligible only if factory finishes, all 13 tasks complete, its full suite and external launch checks pass, and validator accepts. Failed or incomplete trials remain in the dataset; no selective reruns. No steering. No automatic resume after failure: report failure as observed.
