'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Check,
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  Ticket,
} from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { languageLocales } from '@/lib/i18n/config'
import { trackInteraction } from '@/lib/track'

// Native free-ticket tier picker (TIX-1 Stage C). Renders in the event page
// action panel in place of the external-ticket / price row whenever the event
// has active public tiers. All hard rules (availability, caps, windows, civic)
// are re-enforced inside the claim_free_tickets RPC — this UI is presentation
// plus honest error states, never the enforcement layer.

export type TierView = {
  id: string
  name: string
  description: string | null
  capacity: number
  maxPerOrder: number
  available: number
  salesStart: string | null
  salesEnd: string | null
}

type Props = {
  eventId: string
  slug: string
  tiers: TierView[]
  isAuthenticated: boolean
  city: string | null
  country: string | null
}

type TierState = 'ok' | 'sold_out' | 'not_started' | 'ended'

function tierState(tier: TierView, now: number): TierState {
  if (tier.salesStart && Date.parse(tier.salesStart) > now) return 'not_started'
  if (tier.salesEnd && Date.parse(tier.salesEnd) <= now) return 'ended'
  if (tier.available <= 0) return 'sold_out'
  return 'ok'
}

function sellingFast(tier: TierView): boolean {
  return (
    tier.available > 0 &&
    tier.available <= Math.max(2, Math.ceil(tier.capacity * 0.15))
  )
}

const ERROR_KEYS: Record<string, string> = {
  sold_out: 'tix_err_sold_out',
  user_cap_reached: 'tix_err_cap',
  over_max_per_order: 'tix_err_cap',
  sales_not_started: 'tix_err_not_started',
  sales_ended: 'tix_err_closed',
  event_ended: 'tix_err_closed',
  event_cancelled: 'tix_err_closed',
  event_not_published: 'tix_err_closed',
  tier_not_active: 'tix_err_closed',
  tier_not_available: 'tix_err_closed',
  paid_not_available: 'tix_err_closed',
  civic_not_ticketed: 'tix_err_closed',
  tier_not_found: 'tix_err_closed',
}

export default function TierPicker({
  eventId,
  slug,
  tiers,
  isAuthenticated,
  city,
  country,
}: Props) {
  const router = useRouter()
  const { t, language } = useLanguage()
  const now = Date.now()

  const firstClaimable = tiers.find((tier) => tierState(tier, now) === 'ok')
  const [selectedId, setSelectedId] = useState<string | null>(
    firstClaimable?.id ?? null,
  )
  const [quantity, setQuantity] = useState(1)
  const [claiming, setClaiming] = useState(false)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [claimedSerials, setClaimedSerials] = useState<string[] | null>(null)

  useEffect(() => {
    trackInteraction('ticket_view_tiers', {
      entityType: 'event',
      entityId: eventId,
      city,
      country,
    })
    // Fire once per page view — deliberate mount-only analytics ping.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selected = tiers.find((tier) => tier.id === selectedId) ?? null
  const selectedState = selected ? tierState(selected, now) : null
  const maxQuantity = selected
    ? Math.max(1, Math.min(selected.maxPerOrder, selected.available))
    : 1
  const boundedQuantity = Math.min(quantity, maxQuantity)
  const allGone = tiers.every((tier) => tierState(tier, now) !== 'ok')

  const selectTier = (tier: TierView) => {
    if (tierState(tier, now) !== 'ok' || claiming) return
    setSelectedId(tier.id)
    setQuantity(1)
    setErrorKey(null)
  }

  const claim = async () => {
    if (claiming || !selected || selectedState !== 'ok') return
    if (!isAuthenticated) {
      const next = encodeURIComponent(`/events/${slug}`)
      router.push(`/sign-in?next=${next}`)
      return
    }
    setClaiming(true)
    setErrorKey(null)
    try {
      const res = await fetch('/api/tickets/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierId: selected.id, quantity: boundedQuantity }),
      })
      const payload = (await res.json().catch(() => null)) as
        | { error?: string; tickets?: Array<{ serial: string }> }
        | null
      if (res.ok && payload?.tickets) {
        setClaimedSerials(payload.tickets.map((ticket) => ticket.serial))
        trackInteraction('ticket_claim', {
          entityType: 'event',
          entityId: eventId,
          city,
          country,
          meta: { quantity: boundedQuantity },
        })
        // Refresh server-computed availability behind the success panel.
        router.refresh()
      } else {
        const code = payload?.error ?? 'claim_failed'
        if (code === 'auth_required') {
          router.push(`/sign-in?next=${encodeURIComponent(`/events/${slug}`)}`)
          return
        }
        setErrorKey(ERROR_KEYS[code] ?? 'tix_err_generic')
        trackInteraction('ticket_claim_blocked', {
          entityType: 'event',
          entityId: eventId,
          city,
          country,
          meta: { reason: code },
        })
        if (code === 'sold_out') router.refresh()
      }
    } catch {
      setErrorKey('tix_err_generic')
    } finally {
      setClaiming(false)
    }
  }

  if (claimedSerials) {
    return (
      <div className="mt-5 border-t border-white/[0.08] pt-5">
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <p className="inline-flex items-center gap-2 text-base font-bold text-white">
            <CheckCircle2 className="h-5 w-5 text-emerald-300" />
            {t('tix_success_title')}
          </p>
          <p className="mt-1.5 text-sm text-white/75">{t('tix_success_sub')}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {claimedSerials.map((serial) => (
              <span
                key={serial}
                className="rounded-full border border-white/15 bg-ink-950/50 px-2.5 py-1 font-mono text-xs tabular-nums text-white/85"
              >
                {serial}
              </span>
            ))}
          </div>
          <Link
            href="/dashboard/tickets"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-flame-500 px-5 py-2.5 text-sm font-semibold text-white shadow-glow-flame transition hover:bg-flame-400"
          >
            <Ticket className="h-4 w-4" />
            {t('tix_view_my')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-5 border-t border-white/[0.08] pt-5">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
          <Ticket className="h-3.5 w-3.5" />
          {t('tix_tickets_label')}
        </span>
        <span className="text-lg font-semibold text-white">
          {allGone ? t('tix_sold_out') : t('tix_free')}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {tiers.map((tier) => {
          const state = tierState(tier, now)
          const isSelected = tier.id === selectedId && state === 'ok'
          const fast = state === 'ok' && sellingFast(tier)
          return (
            <button
              key={tier.id}
              type="button"
              onClick={() => selectTier(tier)}
              disabled={state !== 'ok' || claiming}
              aria-pressed={isSelected}
              className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                isSelected
                  ? 'border-flame-500/60 bg-flame-500/10'
                  : state === 'ok'
                    ? 'border-white/10 bg-white/[0.04] hover:border-white/25'
                    : 'cursor-not-allowed border-white/[0.06] bg-white/[0.02] opacity-60'
              }`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span
                      className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${
                        isSelected
                          ? 'border-flame-400 bg-flame-500'
                          : 'border-white/25'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </span>
                    <span className="truncate text-sm font-semibold text-white">
                      {tier.name}
                    </span>
                  </span>
                  {tier.description && (
                    <span className="mt-1 block pl-6 text-xs text-white/55">
                      {tier.description}
                    </span>
                  )}
                </span>
                <span className="flex-shrink-0 text-right">
                  {state === 'sold_out' && (
                    <span className="text-xs font-semibold uppercase tracking-wide text-white/45">
                      {t('tix_sold_out')}
                    </span>
                  )}
                  {state === 'not_started' && tier.salesStart && (
                    <span className="text-xs text-white/55">
                      {t('tix_sales_soon')}{' '}
                      <span className="tabular-nums">
                        {new Date(tier.salesStart).toLocaleDateString(
                          languageLocales[language],
                          { day: 'numeric', month: 'short' },
                        )}
                      </span>
                    </span>
                  )}
                  {state === 'ended' && (
                    <span className="text-xs text-white/55">
                      {t('tix_sales_ended')}
                    </span>
                  )}
                  {state === 'ok' &&
                    (fast ? (
                      <span className="text-xs font-semibold text-flame-300">
                        {t('tix_selling_fast')} ·{' '}
                        <span className="tabular-nums">{tier.available}</span>{' '}
                        {t('tix_left_suffix')}
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-white/85">
                        {t('tix_free')}
                      </span>
                    ))}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {selected && selectedState === 'ok' && (
        <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5">
          <span className="text-sm text-white/70">{t('tix_quantity')}</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQuantity(Math.max(1, boundedQuantity - 1))}
              disabled={boundedQuantity <= 1 || claiming}
              aria-label="−1"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-6 text-center text-base font-bold tabular-nums text-white">
              {boundedQuantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity(Math.min(maxQuantity, boundedQuantity + 1))}
              disabled={boundedQuantity >= maxQuantity || claiming}
              aria-label="+1"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {errorKey && (
        <p
          role="alert"
          className="mt-3 rounded-2xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-100"
        >
          {t(errorKey)}
        </p>
      )}

      <button
        type="button"
        onClick={claim}
        disabled={claiming || !selected || selectedState !== 'ok' || allGone}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-flame-500 px-5 py-3 text-sm font-semibold text-white shadow-glow-flame transition hover:-translate-y-0.5 hover:bg-flame-400 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:hover:translate-y-0"
      >
        {claiming ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('tix_claiming')}
          </>
        ) : (
          <>
            <Ticket className="h-4 w-4" />
            {allGone ? t('tix_sold_out') : t('tix_get_free')}
          </>
        )}
      </button>

      {!isAuthenticated && !allGone && (
        <p className="mt-2 text-center text-xs text-white/50">
          {t('tix_signin_hint')}
        </p>
      )}
    </div>
  )
}
