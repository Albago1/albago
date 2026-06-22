'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowDownToLine, Flame, MessageSquareText, Sparkles } from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'
import PlacardCard from '@/components/placards/PlacardCard'
import PlacardFilters from '@/components/placards/PlacardFilters'
import {
  PLACARD_CATEGORY_LABELS,
  PLACARD_FILTER_ORDER,
  PLACARD_LANGUAGE_LABELS,
  featuredPlacard,
  filterPlacards,
  sortPlacards,
  topCategory,
} from '@/lib/placards'
import type { Placard, PlacardSort } from '@/lib/placards'

type Props = { placards: Placard[] }

export default function PankartatClient({ placards }: Props) {
  const [filterKey, setFilterKey] = useState<string>('all')
  const [sort, setSort] = useState<PlacardSort>('newest')

  const filtered = useMemo(() => {
    return sortPlacards(filterPlacards(placards, filterKey), sort)
  }, [placards, filterKey, sort])

  const countsByFilter = useMemo(() => {
    const out: Record<string, number> = {}
    for (const f of PLACARD_FILTER_ORDER) {
      out[f.key] = filterPlacards(placards, f.key).length
    }
    return out
  }, [placards])

  const languageCount = useMemo(() => {
    return new Set(placards.map((p) => p.language)).size
  }, [placards])

  const top = useMemo(() => topCategory(placards), [placards])
  const featured = useMemo(() => featuredPlacard(placards), [placards])

  function scrollToLibrary() {
    document.getElementById('placard-library')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="relative min-h-screen bg-ink-950 text-white">
      <LandingNavbar />

      {/* Hero */}
      <section className="relative isolate overflow-hidden pt-28 sm:pt-32">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-grid opacity-50" />
          <div className="absolute inset-0 bg-radial-flame" />
        </div>

        <div className="mx-auto max-w-5xl px-5 sm:px-8 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="inline-flex items-center gap-2 rounded-full border border-flame-500/40 bg-flame-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-flame-200"
          >
            <Flame className="h-3.5 w-3.5" />
            <span>Pankartat · AlbaGo</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="display-text mt-6 text-4xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-tight"
          >
            Pankartat e <span className="italic text-flame-400">Revolucionit</span>.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-white/65"
          >
            Zgjidh mesazhin tënd, shkarko pankartën dhe bëhu pjesë e zërit të revolucionit.
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <button
              type="button"
              onClick={scrollToLibrary}
              className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_30px_-4px_rgba(238,28,37,0.55)] transition hover:bg-flame-500/90"
            >
              <Sparkles className="h-4 w-4" />
              Shfleto Pankartat
            </button>
            <button
              type="button"
              disabled
              title="Së shpejti — krijo pankartën tënde"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white/55"
            >
              <ArrowDownToLine className="h-4 w-4" />
              Krijo Pankartën Tënde
              <span className="rounded-full bg-white/10 px-2 py-0 text-[10px] uppercase tracking-wide text-white/55">
                Së shpejti
              </span>
            </button>
            <button
              type="button"
              disabled
              title="Së shpejti — dërgo një mesazh të ri për shqyrtim"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white/55"
            >
              <MessageSquareText className="h-4 w-4" />
              Dërgo Mesazh
              <span className="rounded-full bg-white/10 px-2 py-0 text-[10px] uppercase tracking-wide text-white/55">
                Së shpejti
              </span>
            </button>
          </motion.div>
        </div>

        {/* Stats strip */}
        <div className="mx-auto max-w-5xl px-5 sm:px-8 pb-14">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Pankarta" value={String(placards.length)} />
            <StatCard label="Gjuhë" value={String(languageCount)} />
            <StatCard
              label="Më e fuqishme"
              value={featured ? trim(featured.slogan, 18) : '—'}
              tooltip={featured?.slogan}
            />
            <StatCard
              label="Kategoria kryesore"
              value={top ? PLACARD_CATEGORY_LABELS[top.category] : '—'}
              hint={top ? `${top.count} pankarta` : undefined}
            />
          </div>
        </div>
      </section>

      {/* Library */}
      <section id="placard-library" className="relative px-5 sm:px-8 pb-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-col gap-1">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Biblioteka e mesazheve
            </h2>
            <p className="text-sm text-white/55">
              Shkarko si poster për print, ose si grafikë gati për Instagram, WhatsApp dhe Telegram.
            </p>
          </div>

          <div className="mb-8">
            <PlacardFilters
              filterKey={filterKey}
              onFilterChange={setFilterKey}
              sort={sort}
              onSortChange={setSort}
              countsByFilter={countsByFilter}
            />
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-10 text-center">
              <p className="text-white/65">Asnjë pankartë nuk u gjet me këto filtra.</p>
              <button
                type="button"
                onClick={() => setFilterKey('all')}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-flame-500/40 bg-flame-500/10 px-4 py-1.5 text-sm font-semibold text-flame-100 transition hover:bg-flame-500/15"
              >
                Pastro filtrat
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => (
                <PlacardCard key={p.id} placard={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Languages legend */}
      <section className="px-5 sm:px-8 pb-24">
        <div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-white/[0.02] p-8">
          <h3 className="text-lg font-semibold text-white">Gjuhët e mbështetura</h3>
          <p className="mt-2 text-sm text-white/55">
            Çdo pankartë ka markën AlbaGo dhe linkun e drejtpërdrejtë te kjo bibliotekë.
            Përdor cilëndo gjuhë që përshtatet me audiencën tënde.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {Object.entries(PLACARD_LANGUAGE_LABELS).map(([key, info]) => (
              <Link
                key={key}
                href="#placard-library"
                onClick={() => setFilterKey(`lang:${key}`)}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/85 transition hover:border-flame-500/40 hover:text-flame-100"
              >
                <span className="text-base">{info.flag}</span>
                <span>{info.label}</span>
                <span className="rounded-full bg-white/10 px-1.5 py-0 text-[10px] text-white/55">
                  {placards.filter((p) => p.language === key).length}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
  tooltip,
}: {
  label: string
  value: string
  hint?: string
  tooltip?: string
}) {
  return (
    <div
      className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
      title={tooltip ?? undefined}
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
        {value}
      </div>
      {hint && <div className="mt-1 text-[11px] text-white/45">{hint}</div>}
    </div>
  )
}

function trim(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`
}
