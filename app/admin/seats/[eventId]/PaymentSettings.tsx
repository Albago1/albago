'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Landmark, Loader2, Lock, Wallet } from 'lucide-react'
import { consoleCall, errorText, type ConsoleData } from './consoleShared'

const INPUT =
  'h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white placeholder:text-white/30 focus:border-flame-500/40 focus:outline-none'

/**
 * How buyers pay: the bank account behind the scan-to-pay QR code and a
 * PayPal.me name. Saved privately (admin-only table); the saved IBAN never
 * comes back to the browser — it shows masked, and typing a new one replaces it.
 */
export default function PaymentSettings({ data }: { data: ConsoleData }) {
  const router = useRouter()
  const p = data.payment
  const [holder, setHolder] = useState(p?.bankHolder ?? '')
  const [iban, setIban] = useState('')
  const [bic, setBic] = useState(p?.bic ?? '')
  const [paypal, setPaypal] = useState(p?.paypalMe ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const save = async (clearBank = false) => {
    setBusy(true)
    setError(null)
    setSaved(false)
    const body: Record<string, unknown> = { op: 'payment', paypalMe: paypal }
    if (clearBank) Object.assign(body, { bankHolder: '', iban: '', bic: '' })
    else {
      body.bankHolder = holder
      body.bic = bic
      if (iban.trim()) body.iban = iban
    }
    const result = await consoleCall(data.event.id, 'POST', body)
    setBusy(false)
    if (!result.ok) {
      setError(errorText(result.error))
      return
    }
    setIban('')
    if (clearBank) {
      setHolder('')
      setBic('')
    }
    setSaved(true)
    router.refresh()
  }

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40">
        <Lock className="h-3.5 w-3.5" /> Payment details · private
      </h2>
      <p className="mt-1.5 text-xs leading-relaxed text-white/50">
        Buyers with a reservation get a QR code to scan in their banking app, and a PayPal button. Your name and IBAN are
        never shown as text — they are inside the QR code only, which only the buyer of a held reservation can open.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-white sm:col-span-2">
          <Landmark className="h-4 w-4 text-flame-300" /> Bank transfer (QR code)
        </p>
        <label>
          <span className="mb-1 block text-xs text-white/60">Account holder — exactly as your bank has it</span>
          <input value={holder} onChange={(e) => setHolder(e.target.value)} maxLength={70} className={INPUT} autoComplete="off" />
          <span className="mt-1 block text-[11px] text-white/40">Banks check this name against the IBAN before sending.</span>
        </label>
        <label>
          <span className="mb-1 block text-xs text-white/60">IBAN</span>
          <input
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            className={`${INPUT} font-mono`}
            autoComplete="off"
            spellCheck={false}
            placeholder={p?.ibanMasked ?? 'DE00 0000 0000 0000 0000 00'}
          />
          <span className="mt-1 block text-[11px] text-white/40">
            {p?.ibanMasked ? `Saved: ${p.ibanMasked} — type a new one only to replace it.` : 'Not set yet.'}
          </span>
        </label>
        <label>
          <span className="mb-1 block text-xs text-white/60">BIC (optional)</span>
          <input value={bic} onChange={(e) => setBic(e.target.value)} className={`${INPUT} font-mono`} autoComplete="off" spellCheck={false} />
        </label>

        <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-white sm:col-span-2">
          <Wallet className="h-4 w-4 text-flame-300" /> PayPal
        </p>
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs text-white/60">Your PayPal.me name</span>
          <input value={paypal} onChange={(e) => setPaypal(e.target.value)} className={INPUT} autoComplete="off" spellCheck={false} placeholder="from paypal.me/YourName — leave empty for no PayPal button" />
          <span className="mt-1 block text-[11px] text-white/40">
            Buyers are asked to choose “goods and services” and put their reference in the note.
          </span>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-flame-500 px-5 text-sm font-semibold text-white transition hover:bg-flame-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Save payment details
        </button>
        {p?.ibanMasked && (
          <button
            type="button"
            onClick={() => {
              if (confirm('Remove the bank account? Buyers will only see PayPal (if set).')) void save(true)
            }}
            disabled={busy}
            className="text-xs font-semibold text-white/45 transition hover:text-red-200"
          >
            Remove bank account
          </button>
        )}
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300/90">
            <CheckCircle2 className="h-3.5 w-3.5" /> Saved
          </span>
        )}
        {error && <span className="text-xs text-flame-200">{error}</span>}
      </div>
    </section>
  )
}
