export type Spread = { min: number; median: number; max: number }

export type Row = { workload: string; implementation: string; time: Spread; memory: Spread }

export type Results = { node: string; platform: string; arch: string; runs: number; rows: Row[] }
