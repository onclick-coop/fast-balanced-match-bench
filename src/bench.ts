import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Results, Row, Spread } from './results.ts'
import { implementations, workloads } from './workload.ts'

type Sample = { elapsed: number; allocated: number }

const runsText = process.env['BENCH_RUNS'] ?? '25'
const runs = Number(runsText)
if (!Number.isSafeInteger(runs) || runs < 1) throw new Error(`BENCH_RUNS must be a positive whole number, not ${runsText}.`)

const script = fileURLToPath(new URL('./workload.ts', import.meta.url))
const entries = Object.entries(implementations)

const parseSample = (output: string): Sample => {
  const value: unknown = JSON.parse(output)
  if (typeof value !== 'object' || value === null || !('elapsed' in value) || !('allocated' in value)) throw new Error(`A worker printed no sample: ${output}`)

  const { elapsed, allocated } = value
  if (typeof elapsed !== 'number' || typeof allocated !== 'number') throw new Error(`A worker printed no sample: ${output}`)

  return { elapsed, allocated }
}

const spreadOf = (values: number[]): Spread => {
  const sorted = values.toSorted((x, y) => x - y)
  const middle = Math.floor(sorted.length / 2)
  const [min = 0] = sorted
  const max = sorted.at(-1) ?? 0
  // An even count has two middle samples, so the median is their mean.
  const median = sorted.length % 2 ? (sorted[middle] ?? 0) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2

  return { min, median, max }
}

// Every implementation agrees on every workload input first, so the timings compare the same work.
for (const [workloadName, { cases }] of Object.entries(workloads)) {
  for (const [a, b, str] of cases) {
    const answers = entries.map(([, prepare]) => JSON.stringify(prepare(a, b)(str)))
    if (new Set(answers).size > 1) throw new Error(`Implementations differ on the ${workloadName} workload.`)
  }
}

const samples = new Map<string, Sample[]>()
// Each run is a fresh process, and the implementation that goes first alternates by run, so neither always takes a first-run effect.
for (const workloadName of Object.keys(workloads)) {
  for (let run = 0; run < runs; run++) {
    const order = run % 2 ? entries.toReversed() : entries
    for (const [name] of order) {
      const sample = parseSample(execFileSync(process.execPath, [script, name, workloadName], { encoding: 'utf8' }))
      const key = `${workloadName} ${name}`
      samples.set(key, [...(samples.get(key) ?? []), sample])
    }
  }
}

const mebibytes = (bytes: number): string => (bytes / 1_048_576).toFixed(1)
const rows: Row[] = []

console.log(`node ${process.version} on ${process.platform} ${process.arch}, ${runs} runs each, times in ms and allocations over the whole timed loop in MiB`)
for (const [key, list] of samples) {
  const [workload = '', implementation = ''] = key.split(' ')
  const time = spreadOf(list.map(({ elapsed }) => elapsed))
  const memory = spreadOf(list.map(({ allocated }) => allocated))
  rows.push({ workload, implementation, time, memory })
  const timeText = `min ${time.min.toFixed(1)}  median ${time.median.toFixed(1)}  max ${time.max.toFixed(1)}`
  const memoryText = `median ${mebibytes(memory.median)} (${mebibytes(memory.min)} to ${mebibytes(memory.max)})`
  console.log(`${key.padEnd(20)} ${timeText}  |  ${memoryText}`)
}

const results: Results = { node: process.version, platform: process.platform, arch: process.arch, runs, rows }
writeFileSync(new URL('../results.json', import.meta.url), `${JSON.stringify(results, null, 2)}\n`)
