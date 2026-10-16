# Local work archive — 2026-10-16

Branch: `archive/local-work-2026-10-16`.

The branch tip keeps the latest demo working tree, adds the Tetris 006 handout and the local Tetris 004 before-refactoring snapshot, and preserves all local branch and stash histories through an archive merge. Older variants are available in history; they are not combined into the tip.

## Priority handouts

- `docs/tetris-006-one-pager.html`: `7b98292910b8e7530e93d7cafa4c4370a64d6de7`.
- `docs/tetris-007-one-pager.html`: latest version at `7aab12cd48b6cf5a8b9b7f13d3b9ef22fc700d46`.

From your intended destination branch, copy only these files:

```sh
git restore --source=origin/archive/local-work-2026-10-16 -- docs/tetris-006-one-pager.html docs/tetris-007-one-pager.html
git add docs/tetris-006-one-pager.html docs/tetris-007-one-pager.html
git commit -m 'Add Tetris 006 and 007 one-pagers'
```

## Original local branches

- `backup/pre-expo58-rebase-20261008`: `5bc5c6d79682a53c1e37ae8893fe742d77514f16`.
- `checkpoint/tetris-006-free-2026-10-15`: `7f72a4e19e965122613d5b87f626984d8acfa0be`.
- `demo/tetris-004-quality-completed`: `b39638f80bf4fce7068d5012826bf99066497691`.
- `demo/tetris-006`: `7aab12cd48b6cf5a8b9b7f13d3b9ef22fc700d46`.
- `demo/tetris-006-codex-luna`: `786ff1b7902ea12d7787a2cff807a3fb901780f4`.
- `fix/tetris-006-free-result`: `7f72a4e19e965122613d5b87f626984d8acfa0be`.
- `main`: `f27b012e2ffea1b1d66fb2b1a29dbfe00cd7d8d4`.
- `solution/2026-10-11`: `7e2fa14fccc84c0472b6f7b71b1b6d15d3485734`.
- `solution/2026-10-15`: `712a3f792fb1d44fcef829aa9b4ded3edf77148a`.

## Stash snapshots

These ordinary single-parent commits include each stash’s tracked and untracked files and can be cherry-picked. Original stash objects and their index/untracked parents are also preserved in the archive history. Local stashes remain intact.

- On fix/tetris-006-free-result: Recovery before Codex Luna checkpoint restore 20261015T092901Z: `eb8fd8f1a1d483e7ca872a9a52309f8a4c35492a` (original stash `91f34da64d284d40379f120035b0eead302200e0`).
- On main: pre-expo58-rebase-20261008: `47ef8aaab4da8a416fdf27bb769359275d357219` (original stash `c76d3de47e27236b6fe30a2b0b85b993037a0ce2`).

## Scope

The separate `.tmp/workshops` clone is excluded. It is clean with no commits ahead of its locally recorded origin refs; refreshing its remote returned HTTP 403. Ignored `node_modules` and `factory/runs` output are excluded. The ignored Tetris 004 before-refactoring source is included, without dependencies.
