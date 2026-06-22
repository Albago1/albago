import LandingNavbar from '@/components/layout/LandingNavbar'

type Variant = 'directory' | 'placards'

const CARD_COUNT = 6

/**
 * Shared loading skeleton used by /events, /protests, /pankartat loading.tsx
 * files. Mirrors each page's overall structure (hero + filter bar + card grid)
 * so the layout doesn't jump when the real content arrives.
 */
export default function PageSkeleton({
  title,
  subtitle,
  variant = 'directory',
}: {
  title?: string
  subtitle?: string
  variant?: Variant
}) {
  return (
    <div className="relative min-h-screen bg-ink-950 text-white">
      <LandingNavbar />

      <section className="relative isolate overflow-hidden pt-28 sm:pt-32">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-grid opacity-50" />
          <div className="absolute inset-0 bg-radial-flame" />
        </div>

        <div className="mx-auto max-w-7xl px-5 sm:px-8 pb-10">
          {title ? (
            <h1 className="display-text text-4xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-tight text-white/90">
              {title}
            </h1>
          ) : (
            <div className="h-12 sm:h-16 w-2/3 max-w-2xl animate-pulse rounded-2xl bg-white/5" />
          )}

          {subtitle ? (
            <p className="mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-white/55">
              {subtitle}
            </p>
          ) : (
            <div className="mt-6 h-5 w-3/4 max-w-xl animate-pulse rounded-full bg-white/5" />
          )}

          <div className="mt-10 flex flex-wrap gap-2">
            {Array.from({ length: variant === 'placards' ? 7 : 5 }).map((_, i) => (
              <div
                key={i}
                className="h-8 w-24 animate-pulse rounded-full bg-white/5"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 sm:px-8 pb-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: CARD_COUNT }).map((_, i) => (
              <SkeletonCard key={i} variant={variant} delayMs={i * 80} />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function SkeletonCard({ variant, delayMs }: { variant: Variant; delayMs: number }) {
  return (
    <div
      className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div
        className="aspect-square animate-pulse bg-white/[0.04]"
        style={{ animationDelay: `${delayMs}ms` }}
      />
      <div className="flex flex-col gap-3 p-5">
        <div
          className="h-4 w-3/4 animate-pulse rounded-full bg-white/5"
          style={{ animationDelay: `${delayMs + 60}ms` }}
        />
        <div
          className="h-3 w-1/2 animate-pulse rounded-full bg-white/5"
          style={{ animationDelay: `${delayMs + 120}ms` }}
        />
        <div className="mt-2 flex gap-2">
          {Array.from({ length: variant === 'placards' ? 3 : 4 }).map((_, j) => (
            <div
              key={j}
              className="h-6 w-16 animate-pulse rounded-full bg-white/5"
              style={{ animationDelay: `${delayMs + 180 + j * 40}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
