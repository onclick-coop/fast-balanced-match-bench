# fast-balanced-match-bench

[![Release](https://github.com/onclick-coop/fast-balanced-match-bench/actions/workflows/release.yaml/badge.svg)](https://github.com/onclick-coop/fast-balanced-match-bench/actions/workflows/release.yaml)

Benchmarks [`@onclick/fast-balanced-match`](https://github.com/onclick-coop/fast-balanced-match) ([npm](https://www.npmjs.com/package/@onclick/fast-balanced-match), [JSR](https://jsr.io/@onclick/fast-balanced-match)) against [`balanced-match`](https://github.com/juliangruber/balanced-match).

<img src="results.svg" width="100%" alt="Time and memory per workload, fast-balanced-match compared with balanced-match">

## Run it

Clone this repository beside `fast-balanced-match`, then from this one:

```sh
(cd ../fast-balanced-match && vp install && vp run build)
vp install
vp run bench
vp run chart
```

`vp run bench` writes `results.json`, and `vp run chart` draws `results.svg` from it.
`BENCH_RUNS` sets the number of runs, 25 by default.

## Workloads

From `src/workload.ts`:

- **small**: the short inputs from `balanced-match`'s own tests, as `pre{in{nest}}post`.
- **realworld**: globs, templates, function calls, markup and JSON, as `src/{components,utils,hooks,stores}/**/*.{ts,tsx,vue}`.
- **regex**: regular expression delimiters, as `/\s+\{\s+/` and `/\s+\}\s+/`.
- **deep**: one pair nested ten thousand levels deep.
- **unclosed**: ten thousand openings with a single closing at the end.
- **recovery**: ten thousand openings and nine thousand closings, leaving a thousand unclosed.

## Results

Apple M2, Node 26.13.1, 25 runs each, times in milliseconds and memory in MiB allocated over the timed loop:

| Workload  | Time,<br>`balanced-match`             | Time,<br>`fast-balanced-match`        | Memory,<br>`balanced-match` | Memory,<br>`fast-balanced-match` |
| --------- | ------------------------------------- | ------------------------------------- | --------------------------- | -------------------------------- |
| small     | 211.6&nbsp;(202.3&nbsp;to&nbsp;227.6) | 148.9&nbsp;(147.6&nbsp;to&nbsp;166.3) | 728.4                       | 413.6                            |
| realworld | 148.2&nbsp;(146.7&nbsp;to&nbsp;165.6) | 130.8&nbsp;(129.7&nbsp;to&nbsp;147.5) | 574.0                       | 310.4                            |
| regex     | 163.9&nbsp;(162.3&nbsp;to&nbsp;174.2) | 165.4&nbsp;(164.7&nbsp;to&nbsp;178.6) | 558.2                       | 400.5                            |
| deep      | 64.5&nbsp;(64.3&nbsp;to&nbsp;68.6)    | 9.8&nbsp;(9.7&nbsp;to&nbsp;10.5)      | 74.7                        | 0.6                              |
| unclosed  | 34.3&nbsp;(34.1&nbsp;to&nbsp;36.1)    | 7.9&nbsp;(7.9&nbsp;to&nbsp;8.5)       | 74.7                        | 0.6                              |
| recovery  | 61.2&nbsp;(60.9&nbsp;to&nbsp;67.9)    | 15.1&nbsp;(15.0&nbsp;to&nbsp;16.3)    | 74.7                        | 0.5                              |

Each time is the median, with the fastest and slowest run in brackets.
`fast-balanced-match` is faster on every workload but `regex`, where running the regex dominates and the two are within 1%.

## Method

- **Same work.** Both packages must give identical answers before anything is timed, and every field of each answer is read, so no work can be skipped.
- **Fresh processes.** Each run is its own Node process, and which package goes first alternates by run.
- **Memory.** The change in `v8.getHeapStatistics().total_allocated_bytes` over the timed loop barely moves between runs, so it stays reliable on a busy machine.
- **What counts as faster.** One package's fastest run must beat the other's, and its median must agree.

## How it got faster

Each change came from a CPU profile and was kept only if a run on a quiet machine showed it faster.

- **No stack.** `balanced-match` keeps an array of open positions, which a profile showed costing time and garbage collection, so `fast-balanced-match` counts open delimiters instead.
- **Character codes where delimiters are dense.** `{` and `}` style delimiters are read one character at a time in short strings and runs of openings, and found by `indexOf` across long plain text.
- **No walk for a contiguous run.** When a run like `{{{{` is left unclosed, the paired opening's position is computed rather than walked to.
- **A matcher built once.** `matcher(a, b)` chooses how to scan when it is built, so each call only scans.
- **Tried and dropped.** An inline string check, a bitwise delimiter test, and integer sentinels in place of `Infinity` made no measurable difference.

## Verification

`fast-balanced-match` passes [`balanced-match`'s v5.0.0 tests](https://github.com/juliangruber/balanced-match/blob/v5.0.0/test/test.ts), and its oracle test checks every result against a plain stack-based walk on 400,000 seeded random strings.

## License

MIT.
