import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

type Props = {
  /** Most recent period's value. */
  current: number
  /** Prior period for comparison. */
  previous: number
  /** Plural-aware suffix label, e.g. "vs last 30 days". Optional. */
  label?: string
  /** Display absolute delta instead of percentage (useful for tiny counts). */
  asAbsolute?: boolean
}

export default function TrendBadge({
  current,
  previous,
  label,
  asAbsolute = false,
}: Props) {
  // Both zero → no signal worth showing.
  if (current === 0 && previous === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white/35">
        <Minus className="h-3 w-3" />
        no activity {label ? `· ${label}` : ''}
      </span>
    )
  }

  const delta = current - previous
  const direction: 'up' | 'down' | 'flat' =
    delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'

  const Icon =
    direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus

  const tone =
    direction === 'up'
      ? 'text-emerald-300'
      : direction === 'down'
        ? 'text-flame-300'
        : 'text-white/45'

  let value: string
  if (asAbsolute || previous === 0) {
    const sign = delta > 0 ? '+' : ''
    value = `${sign}${delta}`
  } else {
    const pct = Math.round((delta / previous) * 100)
    const sign = pct > 0 ? '+' : ''
    value = `${sign}${pct}%`
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums ${tone}`}
    >
      <Icon className="h-3 w-3" />
      {value}
      {label && <span className="font-normal text-white/40">· {label}</span>}
    </span>
  )
}
