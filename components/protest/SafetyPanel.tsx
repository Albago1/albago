import { Shield } from 'lucide-react'
import { SectionLabel } from '@/components/cinematic/SectionLabel'

type SafetyPanelProps = {
  className?: string
  compact?: boolean
}

const SUPPORT_LIST = [
  'Peaceful, lawful civic gatherings.',
  'Coordination with local authorities.',
  'Family-friendly and inclusive events.',
  'Open organizing and transparent communication.',
]

const NOT_SUPPORTED_LIST = [
  'Violence, intimidation, or property damage.',
  'Harassment, doxxing, or hate speech.',
  'Illegal activity or extremist content.',
  'Misinformation or impersonation.',
]

export function SafetyPanel({ className, compact = false }: SafetyPanelProps) {
  const padding = compact ? 'p-6 sm:p-8' : 'p-8 sm:p-12'
  const headlineSize = compact
    ? 'text-2xl sm:text-3xl'
    : 'text-3xl sm:text-4xl'

  return (
    <div
      className={[
        'rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.01]',
        padding,
        className ?? '',
      ].join(' ')}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-flame-500/15 text-flame-300">
          <Shield className="h-6 w-6" />
        </div>
        <div>
          <SectionLabel>Safety & legality</SectionLabel>
          <h3 className={`display-text mt-4 ${headlineSize}`}>
            What this platform supports — and what it does not.
          </h3>
        </div>
      </div>
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5">
          <p className="text-sm font-semibold text-emerald-300">We support</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-white/75">
            {SUPPORT_LIST.map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-flame-500/20 bg-flame-500/[0.04] p-5">
          <p className="text-sm font-semibold text-flame-300">We do not support</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-white/75">
            {NOT_SUPPORTED_LIST.map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-6 text-xs text-white/45">
        Events and accounts that violate these rules are removed. Local laws always apply —
        organizers are responsible for compliance with their city and country.
      </p>
    </div>
  )
}

export default SafetyPanel
