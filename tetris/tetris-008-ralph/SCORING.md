# Scoring

A fresh game starts at zero. Each gameplay lock awards points once, after
completed rows are compacted and before the next piece is selected or placed:

| Lines in that lock | Points |
| --- | --- |
| 0 | 0 |
| 1 | 100 |
| 2 | 300 |
| 3 | 500 |
| 4 | 800 |

Awards accumulate with no level multiplier. Movement, rotation and non-locking
descent award nothing. A blocked next spawn does not undo that lock's points.
The separate low-level `lockPiece` operation only settles cells; `descend`
owns the complete clear/score/spawn pipeline.

The reserved score row shows the live total. Values longer than 15 characters
show the first 14 characters followed by `…`, keeping the label within the
22-column board width without changing the stored score. Normal gameplay uses
JavaScript numbers (exact integers up to `Number.MAX_SAFE_INTEGER`).
