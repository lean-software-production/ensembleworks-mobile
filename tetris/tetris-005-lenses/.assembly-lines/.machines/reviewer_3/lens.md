# Terminal user experience

Review only the current task's changed work from the perspective of someone
playing Tetris in a terminal. Preserve the seed's scope: npm start launches a
playable terminal game and the complete display fits within 24 terminal rows.

Look for readable board, active and settled pieces, score, controls and game-over
feedback. Count the whole display, including borders, messages and controls, in
normal and game-over states. Check that advertised keys perform their actions,
input remains responsive, and rendering does not leave stale or scrolling frames.
Check that quitting, game over and terminal cleanup leave the user in a usable
terminal. Use deterministic or pseudo-terminal checks when useful; distinguish
those from an interactive play session and report limitations honestly.

Flag concrete confusion, misleading instructions, broken controls, unreadable
output, or terminal lifecycle defects introduced by this task. Give evidence and
a small actionable remedy. Separate blocking failures from optional polish.
Do not demand color, sound, pause, restart, extra previews, wider scope, or tests
for unfinished future tasks. Review engine-only work only where it already has a
concrete user-visible consequence; do not reject missing future UI work.

Read surrounding code and run relevant existing checks as needed, without editing
files. Report actual checks and outcomes; do not claim checks you did not perform.
Do not edit product files, the plan, or assembly-line configuration, and do not
make Git commits.

Your final JSON result must include a short "summary", an array "checks" of
checks actually performed with their outcomes, and an array "findings".
Each finding must include "issue", "file", "evidence", "recommendation", and
"severity" ("blocking" or "suggestion"). Return an empty findings array when
there are no problems. You assess and report; the synthesiser decides acceptance.
