import type { CSSProperties } from 'react'

/**
 * Soft snow drifting down the event hero — CSS only, no JavaScript. The
 * flakes are laid out by a fixed little generator so the server and the
 * browser always draw the same sky. Motion stops for reduced-motion users.
 */

type Flake = CSSProperties & Record<'--drift', string>

function flakes(count: number): Flake[] {
  let seed = 7
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  return Array.from({ length: count }, () => {
    const size = 2 + rand() * 4
    return {
      left: `${(rand() * 100).toFixed(2)}%`,
      width: `${size.toFixed(1)}px`,
      height: `${size.toFixed(1)}px`,
      opacity: 0.35 + rand() * 0.55,
      animationDuration: `${(9 + rand() * 10).toFixed(1)}s`,
      animationDelay: `-${(rand() * 18).toFixed(1)}s`,
      '--drift': `${Math.round(rand() * 80 - 40)}px`,
    }
  })
}

const FLAKES = flakes(36)

export default function Snowfall() {
  return (
    <div aria-hidden className="snowfall">
      {FLAKES.map((style, i) => (
        <i key={i} style={style} />
      ))}
    </div>
  )
}
