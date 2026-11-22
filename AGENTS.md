# fast-balanced-match-bench

Benchmarks `@onclick/fast-balanced-match` against `balanced-match`, linked to the library's checkout beside it, and holds the write-up of how its speed-up was found and verified.
`package.json` defines its scripts and the link.

Top-level directories: `src/` (`bench.ts`, which runs and summarizes, `workload.ts`, the workloads and one timed run, and `results.ts`, the saved results' shape) and `scripts/` (`chart.ts`, which draws `results.svg` from `results.json`, and `ci/`, the release step `.github/workflows/release.yaml` runs).

## Checks

Run `vp run check`, `vp run lint`, and `vp run typecheck` from the repo root, and `vp run bench` after `vp run build` in `../fast-balanced-match`.

## Rules

Read [AGENTS.md](../../AGENTS.md) and its topic imports unless already loaded.
