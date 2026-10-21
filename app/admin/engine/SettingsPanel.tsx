'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Settings2 } from 'lucide-react'

export type EngineSettingsProps = {
  expiry: { enabled: boolean; grace_days: number }
  lastRun: { at: string; removed: number; cutoff: string } | null
}

const GRACE_OPTIONS = [
  { days: 0, label: 'The day after it ends' },
  { days: 1, label: '1 day after it ends' },
  { days: 3, label: '3 days after it ends' },
  { days: 7, label: '7 days after it ends' },
]

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function SettingsPanel({ settings }: { settings: EngineSettingsProps }) {
  const router = useRouter()
  const [expiry, setExpiry] = useState(settings.expiry)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  async function save(next: EngineSettingsProps['expiry']) {
    const previous = expiry
    setExpiry(next)
    setSaving(true)
    setStatus(null)
    try {
      const res = await fetch('/api/admin/engine/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiry: next }) })
      const body = await res.json()
      if (!res.ok || !body.ok) throw new Error(body.message ?? body.error ?? 'failed')
      setStatus({ tone: 'ok', text: body.removed ? `Saved · ${body.removed} ended suggestion${body.removed === 1 ? '' : 's'} removed` : 'Saved' })
      router.refresh()
    } catch (error) {
      setExpiry(previous)
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : 'Could not save' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-flame-300" />
        <h2 className="text-sm font-semibold text-white">Settings</h2>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/50" />}
        {status && !saving && (
          <span className={`flex items-center gap-1 text-xs ${status.tone === 'ok' ? 'text-emerald-300' : 'text-red-300'}`}>
            {status.tone === 'ok' && <Check className="h-3.5 w-3.5" />}
            {status.text}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">Remove ended events automatically</p>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-white/55">
            Suggestions still waiting for review are deleted once their event is over, so this page only shows what can still happen. Events you approved stay in the
            engine&apos;s history, and on AlbaGo past events are archived as usual.
          </p>
          <p className="mt-2 text-[11px] text-white/40">
            {settings.lastRun ? `Last clean-up ${when(settings.lastRun.at)} · ${settings.lastRun.removed} removed` : 'Runs with every automatic discovery (5× a day) and whenever you change this.'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <select
            value={expiry.grace_days}
            disabled={!expiry.enabled || saving}
            onChange={(e) => save({ ...expiry, grace_days: Number(e.target.value) })}
            aria-label="When to remove ended events"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white disabled:opacity-40 [&_option]:bg-[#111]"
          >
            {GRACE_OPTIONS.map((o) => (
              <option key={o.days} value={o.days}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            role="switch"
            aria-checked={expiry.enabled}
            aria-label="Remove ended events automatically"
            disabled={saving}
            onClick={() => save({ ...expiry, enabled: !expiry.enabled })}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${expiry.enabled ? 'bg-flame-500' : 'bg-white/15'} disabled:opacity-60`}
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${expiry.enabled ? 'left-6' : 'left-1'}`} />
          </button>
        </div>
      </div>
    </section>
  )
}
