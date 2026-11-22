import { readFileSync, writeFileSync } from 'node:fs'
import type { Results, Row } from '../src/results.ts'

type Measure = 'time' | 'memory'

const results: Results = JSON.parse(readFileSync(new URL('../results.json', import.meta.url), 'utf8'))

const labelWidth = 110
const barWidth = 520
const valueWidth = 90
const barHeight = 14
const barGap = 4
const groupGap = 16
const width = labelWidth + barWidth + valueWidth

const implementations = [
  { key: 'upstream', name: 'balanced-match', className: 'theirs' },
  { key: 'ours', name: 'fast-balanced-match', className: 'ours' },
] as const

const sections: { measure: Measure; heading: string }[] = [
  { measure: 'time', heading: 'Time per workload, in ms (shorter is faster)' },
  { measure: 'memory', heading: 'Memory allocated per workload, in MiB (shorter is less)' },
]

const medianOf = (workload: string, implementation: string, measure: Measure): number => {
  const row: Row | undefined = results.rows.find((candidate) => candidate.workload === workload && candidate.implementation === implementation)
  if (!row) throw new Error(`results.json has no ${implementation} row for ${workload}.`)

  return row[measure].median
}

// Every value keeps one decimal, so the right-aligned monospaced column lines up on the decimal point.
const format = (measure: Measure, value: number): string => (measure === 'time' ? `${value.toFixed(1)} ms` : `${(value / 1_048_576).toFixed(1)} MiB`)

const workloadNames = [...new Set(results.rows.map(({ workload }) => workload))]
const parts: string[] = []
let y = 0

// The legend names each implementation's color once, above both sections.
y += 40
for (const [index, { name, className }] of implementations.entries()) {
  const x = index * 200
  parts.push(`<rect x="${x}" y="${y - 11}" width="12" height="12" rx="2" class="${className}"/>`)
  parts.push(`<text x="${x + 18}" y="${y}" class="label">${name}</text>`)
}

// Each workload's two bars share one scale, set by the larger value, so their lengths compare directly.
for (const { measure, heading } of sections) {
  y += 34
  parts.push(`<text x="0" y="${y}" class="heading">${heading}</text>`)
  y += 12

  for (const workload of workloadNames) {
    const values = implementations.map(({ key }) => medianOf(workload, key, measure))
    const largest = Math.max(...values)
    const groupHeight = implementations.length * barHeight + barGap
    parts.push(`<text x="0" y="${y + groupHeight / 2 + 4}" class="label">${workload}</text>`)

    for (const [index, { className }] of implementations.entries()) {
      const value = values[index] ?? 0
      const length = Math.max(2, (value / largest) * barWidth)
      const top = y + index * (barHeight + barGap)
      parts.push(`<rect x="${labelWidth}" y="${top}" width="${length.toFixed(1)}" height="${barHeight}" rx="3" class="${className}"/>`)
      parts.push(`<text x="${width}" y="${top + barHeight - 3}" text-anchor="end" class="value">${format(measure, value)}</text>`)
    }

    y += groupHeight + groupGap
  }
}

const title = 'fast-balanced-match compared with balanced-match'
const subtitle = `Median of ${results.runs} runs, node ${results.node} on ${results.platform} ${results.arch}`
const height = y
// Mid-tone colors that read on both GitHub's light and dark backgrounds.
const palette = Object.freeze({ text: '#6e7781', heading: '#8c959f', theirs: '#8c959f', ours: '#2f81f7' })
const style = [
  `.label, .value, .title, .heading { font: 13px ui-sans-serif, system-ui, sans-serif; fill: ${palette.text} }`,
  '.title { font-size: 14px; font-weight: 600 }',
  '.value { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px }',
  `.heading { font-weight: 600; fill: ${palette.heading} }`,
  `.theirs { fill: ${palette.theirs}; fill-opacity: 0.6 }`,
  `.ours { fill: ${palette.ours} }`,
].join(' ')

const svg = [
  // Only a viewBox, with no fixed width or height, so the chart scales to fill the page it sits on.
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}. ${subtitle}">`,
  `<style>${style}</style>`,
  `<text x="0" y="16" class="title">${title}</text>`,
  `<text x="${width}" y="16" text-anchor="end" class="label">${subtitle}</text>`,
  ...parts,
  '</svg>',
  '',
].join('\n')

writeFileSync(new URL('../results.svg', import.meta.url), svg)
console.log(`wrote results.svg for ${workloadNames.length} workloads`)
