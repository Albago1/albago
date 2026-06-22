type Props = {
  /** Values to chart, oldest → newest. */
  values: number[]
  /** Width in px. Defaults to 96. */
  width?: number
  /** Height in px. Defaults to 32. */
  height?: number
  /** Hex / rgb fill for bars. */
  color?: string
}

/**
 * Minimal inline-SVG bar sparkline. No deps, no chart library, no axes.
 * Renders nothing if all values are zero (an empty chart reads as noise).
 */
export default function Sparkline({
  values,
  width = 96,
  height = 32,
  color = 'rgba(238,28,37,0.7)',
}: Props) {
  if (!values.length) return null
  const max = Math.max(...values, 1)
  const gap = 2
  const barW = (width - gap * (values.length - 1)) / values.length

  if (max === 0) {
    return (
      <div
        style={{ width, height }}
        className="rounded-sm bg-white/[0.04]"
        aria-hidden="true"
      />
    )
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-hidden="true"
      className="block"
    >
      {values.map((v, i) => {
        const h = Math.max(2, (v / max) * height)
        const x = i * (barW + gap)
        const y = height - h
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={h}
            rx={1}
            fill={color}
          />
        )
      })}
    </svg>
  )
}
