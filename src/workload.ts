import { getHeapStatistics } from 'node:v8'
import { balanced } from 'balanced-match'
import { type Matcher, matcher } from '@onclick/fast-balanced-match'

type Case = [string | RegExp, string | RegExp, string]
type Workload = { cases: Case[]; iterations: number }
type Match = ReturnType<Matcher>
type Prepare = (a: string | RegExp, b: string | RegExp) => Matcher

const small: Case[] = [
  ['{', '}', 'pre{in{nest}}post'],
  ['{', '}', '{{{{{{{{{in}post'],
  ['{', '}', 'pre{body{in}post'],
  ['{', '}', 'pre{body}between{body2}post'],
  ['<b>', '</b>', 'pre<b>in<b>nest</b></b>post'],
  ['{{', '}}', 'pre{{{in}}}post'],
  ['___', '___', 'PRE ___BODY___ POST'],
  ['{', '}', 'nope'],
]

const realworld: Case[] = [
  ['{', '}', 'src/{components,utils,hooks,stores}/**/*.{ts,tsx,vue}'],
  ['{{', '}}', 'Hello {{user.name}}, you have {{count}} new messages from {{sender.display}}.'],
  ['(', ')', 'const total = sum(a, max(b, min(c, d)), avg(e, f)) + offset'],
  ['<div>', '</div>', '<div><div><span>inner</span></div><div>two</div></div><p>after</p>'],
  ['[', ']', '{"tags":["alpha","beta","gamma"],"nested":[[1,2],[3,4]],"n":[1]}'],
]

const regex: Case[] = [
  [/\s+\{\s+/, /\s+\}\s+/, 'pre  {   in{nest}   }  post'],
  [/<b\b[^>]*>/, /<\/b>/, 'say <b class="x">hello <b>there</b></b> now'],
  [/\$\{/, /\}/, 'const greeting = `Hello ${user.name}, you have ${count} messages`'],
]

export const workloads: Record<string, Workload> = {
  small: { cases: small, iterations: 300_000 },
  realworld: { cases: realworld, iterations: 300_000 },
  regex: { cases: regex, iterations: 300_000 },
  deep: { cases: [['{', '}', '{'.repeat(10_000) + '}'.repeat(10_000)]], iterations: 300 },
  unclosed: { cases: [['{', '}', '{'.repeat(10_000) + 'x}']], iterations: 300 },
  // Nine thousand closings leave a thousand openings unclosed, so the pair is found by stepping forward from the first opening.
  recovery: { cases: [['{', '}', '{'.repeat(10_000) + 'x' + '}'.repeat(9_000)]], iterations: 300 },
}

// Each implementation is prepared once per delimiter pair and then called per string, as a caller reusing a pair would.
export const implementations: Record<string, Prepare> = {
  upstream: (a, b) => (str) => balanced(a, b, str),
  ours: matcher,
}

// Every field of the answer feeds the sink, so no part of the work can be optimized away unread.
const weigh = (match: Match): number => (match ? match.start + match.end + match.pre.length + match.body.length + match.post.length : 0)

// Run as a script, one implementation over one workload in a fresh process, printing the milliseconds and bytes allocated by the timed loop.
if (import.meta.main) {
  const [name, workloadName] = process.argv.slice(2)
  const prepare = implementations[name ?? '']
  const workload = workloads[workloadName ?? '']
  if (!prepare || !workload) throw new Error('Usage: node src/workload.ts <upstream|ours> <workload>')

  const calls = workload.cases.map(([a, b, str]) => {
    const match = prepare(a, b)

    return (): Match => match(str)
  })

  let sink = 0
  for (let i = 0; i < 2000; i++) for (const call of calls) sink += weigh(call())

  const allocatedBefore = getHeapStatistics().total_allocated_bytes
  const started = performance.now()
  for (let i = 0; i < workload.iterations; i++) for (const call of calls) sink += weigh(call())
  const elapsed = performance.now() - started
  const allocated = getHeapStatistics().total_allocated_bytes - allocatedBefore

  console.log(JSON.stringify({ elapsed, allocated, sink }))
}
