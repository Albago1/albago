'use client'

import { Check, ExternalLink, Plus, QrCode, Ticket, Trash2, Users } from 'lucide-react'
import {
  MAX_TICKET_TIERS,
  type DraftTicketTier,
  type EventDraft,
} from '@/types/eventDraft'
import type { WizardMode } from '../EventCreationWizard'

type Props = {
  draft: EventDraft
  patch: (patch: Partial<EventDraft>) => void
  mode: WizardMode
}

// Optional step (Phase 33): where do people get in? Three honest answers —
// nothing to buy, bought on someone else's site, or claimed here on AlbaGo.
// Only reachable in organizer/admin modes for non-civic events — the wizard
// hides the step otherwise. Tiers are created via the organizer_save_tier RPC
// right after the event row exists (see wizardSubmit.saveDraftTiers).

function newTier(): DraftTicketTier {
  return { id: null, name: 'Free entry', capacity: '', maxPerOrder: '4' }
}

export default function TicketsStep({ draft, patch, mode: wizardMode }: Props) {
  const mode = draft.ticket_mode
  const tiers = draft.ticket_tiers ?? []

  // "Sold somewhere else" writes events.ticket_url directly, which only the
  // admin path does — organizer creation goes through organizer_create_event_v2,
  // and that RPC has no ticket_url parameter yet. Offering the option there
  // would silently drop the link, so it stays admin-only until the RPC gains it.
  const canLinkOut = wizardMode === 'admin'

  // Switching modes clears the other mode's data, so an event can never carry
  // both a "buy elsewhere" link and AlbaGo tiers — the event page would then
  // have two competing CTAs, which the ticketing spec forbids outright.
  const setMode = (next: EventDraft['ticket_mode']) => {
    if (next === mode) return
    if (next === 'none') {
      patch({ ticket_mode: 'none', ticket_tiers: null, ticket_url: '', ticket_provider: '' })
    } else if (next === 'external') {
      patch({ ticket_mode: 'external', ticket_tiers: null })
    } else {
      patch({
        ticket_mode: 'albago',
        ticket_url: '',
        ticket_provider: '',
        ticket_tiers: tiers.length > 0 ? tiers : [newTier()],
      })
    }
  }

  const setTier = (index: number, tierPatch: Partial<DraftTicketTier>) => {
    patch({
      ticket_tiers: tiers.map((tier, i) =>
        i === index ? { ...tier, ...tierPatch } : tier,
      ),
    })
  }

  const removeTier = (index: number) => {
    patch({ ticket_tiers: tiers.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Tickets</h2>
        <p className="mt-1 text-sm text-white/55">
          Where do people get in? Pick one — the event page shows a single, clear
          way to buy.
        </p>
      </div>

      <div className={`grid gap-3 ${canLinkOut ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        <ChoiceCard
          active={mode === 'none'}
          title="No tickets"
          subtitle="People just show up — the event page stays as it is."
          onClick={() => setMode('none')}
        />
        {canLinkOut && (
          <ChoiceCard
            active={mode === 'external'}
            title="Sold somewhere else"
            subtitle="Tickets live on another site — we send people straight there."
            onClick={() => setMode('external')}
          />
        )}
        <ChoiceCard
          active={mode === 'albago'}
          title="Tickets on AlbaGo"
          subtitle="Guests claim a ticket and get a QR code you can scan at the door."
          onClick={() => setMode('albago')}
        />
      </div>

      {mode === 'external' && (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div>
            <label htmlFor="ticket-url" className="mb-1.5 block text-sm font-medium text-white/80">
              Ticket link <span className="text-flame-400">*</span>
            </label>
            <input
              id="ticket-url"
              type="url"
              inputMode="url"
              value={draft.ticket_url}
              onChange={(e) => patch({ ticket_url: e.target.value })}
              placeholder="https://…"
              className="input"
            />
            <p className="mt-1.5 text-xs text-white/45">
              The page where people actually buy. This becomes the “Get tickets”
              button on the event.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="ticket-provider"
                className="mb-1.5 block text-sm font-medium text-white/80"
              >
                Sold by
              </label>
              <input
                id="ticket-provider"
                type="text"
                value={draft.ticket_provider}
                onChange={(e) => patch({ ticket_provider: e.target.value })}
                placeholder="Eventbrite, the venue, …"
                className="input"
              />
              <p className="mt-1.5 text-xs text-white/45">
                Shown as “via {draft.ticket_provider.trim() || '…'}”. Optional.
              </p>
            </div>
            <div>
              <label htmlFor="ticket-price" className="mb-1.5 block text-sm font-medium text-white/80">
                Price
              </label>
              <input
                id="ticket-price"
                type="text"
                value={draft.price}
                onChange={(e) => patch({ price: e.target.value })}
                placeholder="1500 LEK, from €20, free…"
                className="input"
              />
              <p className="mt-1.5 text-xs text-white/45">
                Exactly as the seller states it. Optional.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 text-xs text-white/55">
            <ExternalLink className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-flame-300/80" />
            People leave AlbaGo to buy, so we can’t scan these at the door or
            show you who’s coming.
          </div>
        </div>
      )}

      {mode === 'albago' && (
        <>
          <div className="space-y-3">
            {tiers.map((tier, index) => (
              <div
                key={index}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/45">
                    <Ticket className="h-3.5 w-3.5" />
                    Ticket type {tiers.length > 1 ? index + 1 : ''}
                  </span>
                  {tiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTier(index)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-white/60 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-200"
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove
                    </button>
                  )}
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px_120px]">
                  <div>
                    <label
                      htmlFor={`tier-name-${index}`}
                      className="mb-1.5 block text-sm font-medium text-white/80"
                    >
                      Name <span className="text-flame-400">*</span>
                    </label>
                    <input
                      id={`tier-name-${index}`}
                      type="text"
                      value={tier.name}
                      onChange={(e) => setTier(index, { name: e.target.value })}
                      placeholder="Free entry"
                      className="input"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`tier-capacity-${index}`}
                      className="mb-1.5 block text-sm font-medium text-white/80"
                    >
                      Capacity <span className="text-flame-400">*</span>
                    </label>
                    <input
                      id={`tier-capacity-${index}`}
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={tier.capacity}
                      onChange={(e) => setTier(index, { capacity: e.target.value })}
                      placeholder="100"
                      className="input"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`tier-max-${index}`}
                      className="mb-1.5 block text-sm font-medium text-white/80"
                    >
                      Max / person
                    </label>
                    <input
                      id={`tier-max-${index}`}
                      type="number"
                      min={1}
                      max={10}
                      inputMode="numeric"
                      value={tier.maxPerOrder}
                      onChange={(e) => setTier(index, { maxPerOrder: e.target.value })}
                      placeholder="4"
                      className="input"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {tiers.length < MAX_TICKET_TIERS && (
            <button
              type="button"
              onClick={() => patch({ ticket_tiers: [...tiers, newTier()] })}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/[0.08] hover:text-white"
            >
              <Plus className="h-4 w-4" />
              Add another ticket type
            </button>
          )}

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <ul className="space-y-2 text-xs text-white/55">
              <li className="flex items-start gap-2">
                <QrCode className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-flame-300/80" />
                Guests claim tickets right on your event page and get a signed QR
                code in their account.
              </li>
              <li className="flex items-start gap-2">
                <Users className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-flame-300/80" />
                Capacity is enforced automatically — overselling is impossible,
                even in a last-second rush.
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-flame-300/80" />
                Tickets are free for now. Paid tickets arrive with payments —
                your setup here carries over.
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

function ChoiceCard({
  active,
  title,
  subtitle,
  onClick,
}: {
  active: boolean
  title: string
  subtitle: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-2xl border p-4 text-left transition ${
        active
          ? 'border-flame-500/60 bg-flame-500/10'
          : 'border-white/10 bg-white/[0.04] hover:border-white/25'
      }`}
    >
      <span className="flex items-center gap-2">
        <span
          className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${
            active ? 'border-flame-400 bg-flame-500' : 'border-white/25'
          }`}
        >
          {active && <Check className="h-3 w-3 text-white" />}
        </span>
        <span className="text-sm font-semibold text-white">{title}</span>
      </span>
      <span className="mt-1.5 block pl-6 text-xs text-white/55">{subtitle}</span>
    </button>
  )
}
