'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Check, Vote } from 'lucide-react'
import type { Poll, PollOption } from '@/lib/polls'
import { getSessionId } from '@/lib/track'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

/**
 * "Who wins?" — a fan poll on the fighters' photo cards. Tap a fighter to
 * vote; the cards then fill with each side's share. Results show only after
 * voting (or once voting has closed), so the first tap isn't swayed.
 */

type Lang = 'en' | 'sq' | 'de' | 'es'
type Totals = { totals: Record<string, number>; total: number }

const COPY: Record<Lang, {
  title: string
  sub: string
  chip: string
  role: Record<PollOption['role'], string>
  tap: string
  votes: (n: number) => string
  yourPick: (name: string) => string
  change: string
  closed: string
  failed: string
}> = {
  en: {
    title: 'Who wins on 28 November?',
    sub: 'Tap your fighter — see what everyone else thinks.',
    chip: 'Fan poll',
    role: { champion: 'WBC champion', challenger: 'Challenger' },
    tap: 'Tap to vote',
    votes: (n) => (n === 1 ? '1 vote' : `${n.toLocaleString('en-GB')} votes`),
    yourPick: (n) => `Your pick: ${n}`,
    change: 'Tap the other fighter to change it.',
    closed: 'Voting has closed — the fans’ verdict.',
    failed: 'Your vote didn’t go through — try again.',
  },
  sq: {
    title: 'Kush fiton më 28 Nëntor?',
    sub: 'Prek boksierin tënd — shiko çfarë mendojnë të tjerët.',
    chip: 'Sondazh',
    role: { champion: 'Kampion WBC', challenger: 'Sfidues' },
    tap: 'Prek për të votuar',
    votes: (n) => (n === 1 ? '1 votë' : `${n.toLocaleString('de-DE')} vota`),
    yourPick: (n) => `Zgjedhja jote: ${n}`,
    change: 'Prek boksierin tjetër për ta ndryshuar.',
    closed: 'Votimi u mbyll — vendimi i tifozëve.',
    failed: 'Vota nuk u ruajt — provo përsëri.',
  },
  de: {
    title: 'Wer gewinnt am 28. November?',
    sub: 'Tippe auf deinen Boxer — und sieh, was die anderen denken.',
    chip: 'Fan-Umfrage',
    role: { champion: 'WBC-Weltmeister', challenger: 'Herausforderer' },
    tap: 'Tippen zum Abstimmen',
    votes: (n) => (n === 1 ? '1 Stimme' : `${n.toLocaleString('de-DE')} Stimmen`),
    yourPick: (n) => `Dein Tipp: ${n}`,
    change: 'Tippe auf den anderen Boxer, um ihn zu ändern.',
    closed: 'Die Abstimmung ist beendet — das Urteil der Fans.',
    failed: 'Deine Stimme wurde nicht gespeichert — versuch es noch einmal.',
  },
  es: {
    title: '¿Quién gana el 28 de noviembre?',
    sub: 'Toca a tu boxeador y mira lo que piensan los demás.',
    chip: 'Encuesta',
    role: { champion: 'Campeón WBC', challenger: 'Aspirante' },
    tap: 'Toca para votar',
    votes: (n) => (n === 1 ? '1 voto' : `${n.toLocaleString('es-ES')} votos`),
    yourPick: (n) => `Tu elección: ${n}`,
    change: 'Toca al otro boxeador para cambiarla.',
    closed: 'La votación ha terminado — el veredicto de la afición.',
    failed: 'Tu voto no se guardó — inténtalo de nuevo.',
  },
}

const pickKey = (poll: Poll) => `albago_poll:${poll.key}`

/** Whole-number shares that always add up to 100. */
function shares(totals: Record<string, number>, keys: string[]): Record<string, number> {
  const total = keys.reduce((n, k) => n + (totals[k] ?? 0), 0)
  if (!total) return Object.fromEntries(keys.map((k) => [k, 0]))
  const raw = keys.map((k) => ((totals[k] ?? 0) / total) * 100)
  const out = raw.map(Math.floor)
  let left = 100 - out.reduce((a, b) => a + b, 0)
  raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]).forEach(([, i]) => {
    if (left-- > 0) out[i]++
  })
  return Object.fromEntries(keys.map((k, i) => [k, out[i]]))
}

export default function FightPoll({ poll, closed }: { poll: Poll; closed: boolean }) {
  const { language } = useLanguage()
  const [mounted, setMounted] = useState(false)
  const [mine, setMine] = useState<string | null>(null)
  const [data, setData] = useState<Totals | null>(null)
  const [failed, setFailed] = useState(false)
  const busy = useRef(false)

  useEffect(() => {
    // English on the server and first paint (no hydration mismatch); then
    // the visitor's language and their earlier pick from this browser.
    setMounted(true)
    try {
      const saved = window.localStorage.getItem(pickKey(poll))
      if (saved && poll.options.some((o) => o.key === saved)) setMine(saved)
    } catch {
      /* storage blocked — they can still vote */
    }
    let gone = false
    fetch(`/api/polls/${poll.key}`)
      .then((r) => r.json())
      .then((j: { ok: boolean } & Totals) => {
        if (!gone && j.ok) setData({ totals: j.totals, total: j.total })
      })
      .catch(() => {})
    return () => {
      gone = true
    }
  }, [poll])

  const lang: Lang = mounted && (language === 'sq' || language === 'de' || language === 'es') ? language : 'en'
  const c = COPY[lang]
  const keys = poll.options.map((o) => o.key)
  const showResults = (!!mine || closed) && !!data
  const pct = data ? shares(data.totals, keys) : null

  const vote = async (key: string) => {
    if (closed || busy.current || key === mine) return
    busy.current = true
    setFailed(false)
    const before = { mine, data }
    // Optimistic: move the vote now, settle with the server's count after.
    setMine(key)
    if (data) {
      const totals = { ...data.totals, [key]: (data.totals[key] ?? 0) + 1 }
      if (mine) totals[mine] = Math.max(0, (totals[mine] ?? 0) - 1)
      setData({ totals, total: data.total + (mine ? 0 : 1) })
    }
    try {
      const res = await fetch(`/api/polls/${poll.key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: getSessionId() ?? crypto.randomUUID(), choice: key }),
      })
      const j = (await res.json()) as { ok: boolean } & Partial<Totals>
      if (!j.ok) throw new Error('vote')
      if (j.totals && typeof j.total === 'number') setData({ totals: j.totals, total: j.total })
      try {
        window.localStorage.setItem(pickKey(poll), key)
      } catch {
        /* storage blocked */
      }
    } catch {
      setMine(before.mine)
      setData(before.data)
      setFailed(true)
    } finally {
      busy.current = false
    }
  }

  const picked = poll.options.find((o) => o.key === mine)

  return (
    <section aria-labelledby={`poll-${poll.key}`} className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.01] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 id={`poll-${poll.key}`} className="font-display text-2xl leading-tight text-white sm:text-3xl">
          {c.title}
        </h2>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white/80">
          <Vote className="h-3 w-3 text-flame-300" />
          {c.chip}
          {data && data.total > 0 && <span className="text-white/50">· {c.votes(data.total)}</span>}
        </span>
      </div>
      <p className="mt-1.5 text-sm text-white/60">{c.sub}</p>

      <div className="relative mt-4 grid grid-cols-2 gap-2 sm:gap-3">
        {poll.options.map((o) => {
          const on = mine === o.key
          const share = pct?.[o.key] ?? 0
          return (
            <button
              key={o.key}
              type="button"
              aria-pressed={on}
              disabled={closed}
              onClick={() => void vote(o.key)}
              className={`group relative h-56 overflow-hidden rounded-2xl border text-left transition duration-300 sm:h-72 ${on ? 'border-white/60' : 'border-white/10 hover:border-white/30'} ${mine && !on ? 'opacity-80' : ''} disabled:cursor-default`}
              style={on ? { boxShadow: `0 0 0 1px ${o.color}, 0 18px 40px -12px ${o.color}` } : undefined}
            >
              {o.photo && (
                <Image
                  src={o.photo}
                  alt={o.fullName}
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 50vw, 360px"
                  className="object-cover object-[50%_18%] transition duration-500 group-hover:scale-105"
                />
              )}
              {/* The fighter's share rises from the bottom once results show */}
              <div
                className="absolute inset-x-0 bottom-0 transition-[height] duration-700 ease-out"
                style={{
                  height: showResults ? `${Math.max(18, share)}%` : '0%',
                  background: `linear-gradient(to top, ${o.color}, color-mix(in srgb, ${o.color} 55%, transparent))`,
                }}
              />
              <div className="absolute inset-0" style={{ background: `linear-gradient(to top, color-mix(in srgb, ${o.color} 85%, black) 0%, color-mix(in srgb, ${o.color} 35%, transparent) 38%, transparent 70%)` }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />
              <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/75">{c.role[o.role]}</p>
                <p className="mt-0.5 font-display text-[1.6rem] leading-none text-white sm:text-3xl">
                  <span className="mr-1 text-xl">{o.flag}</span>
                  {o.name}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-white/80">{o.record}</p>
                {showResults ? (
                  <p className="mt-2 font-display text-3xl leading-none text-white tabular-nums sm:text-4xl">{share}%</p>
                ) : (
                  !closed && (
                    <p className="mt-2 inline-flex rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                      {c.tap}
                    </p>
                  )
                )}
              </div>
              {on && (
                <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-ink-950">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
        <span className="pointer-events-none absolute left-1/2 top-[34%] flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-ink-950 font-display text-base text-white shadow-[0_8px_24px_rgba(0,0,0,0.6)]">
          VS
        </span>
      </div>

      <p className="mt-3 text-center text-xs text-white/50" aria-live="polite">
        {failed ? c.failed : closed ? c.closed : picked ? `${c.yourPick(picked.name)} · ${c.change}` : ''}
      </p>
    </section>
  )
}
