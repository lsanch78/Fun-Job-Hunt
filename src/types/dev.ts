export interface StatCardProps {
  label: string
  value: string
  sub?: string
  accent?: 'green' | 'red' | 'blue' | 'yellow' | 'muted'
}

export interface SliderRowProps {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}

export type Tab = 'FEEDBACK' | 'COSTS'
