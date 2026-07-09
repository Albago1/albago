'use client'

import { useId, useState, useTransition } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Camera,
  Car,
  CheckCircle2,
  Compass,
  Gavel,
  Heart,
  Languages,
  Megaphone,
  Palette,
  Send,
  Shield,
  Sparkles,
  Users,
  Video,
} from 'lucide-react'
import LandingNavbar from '@/components/layout/LandingNavbar'
import { Reveal } from '@/components/cinematic/Reveal'
import { SectionLabel } from '@/components/cinematic/SectionLabel'
import { CinematicLink } from '@/components/cinematic/CinematicButton'
import { submitVolunteerSignup } from './actions'
import type { VolunteerRoleKey } from './volunteer-shared'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

type Props = {
  movementSlug: string
}

type Role = {
  key: VolunteerRoleKey
  labelKey: string
  icon: typeof Users
  body: string
}

const ROLES: Role[] = [
  {
    key: 'organizer',
    labelKey: 'volunteer_role_organizer',
    icon: Compass,
    body: 'Lead a city. Coordinate marshals. Liaise with local authorities.',
  },
  {
    key: 'designer',
    labelKey: 'volunteer_role_designer',
    icon: Palette,
    body: 'Posters, social tiles, square signage. Make the movement look like itself.',
  },
  {
    key: 'video-editor',
    labelKey: 'volunteer_role_video_editor',
    icon: Video,
    body: 'Short cuts for the diaspora feed. Highlights, recaps, interviews.',
  },
  {
    key: 'translator',
    labelKey: 'volunteer_role_translator',
    icon: Languages,
    body: 'Open letters, safety pages, and announcements in EN / SQ / DE / IT.',
  },
  {
    key: 'marshal',
    labelKey: 'volunteer_role_marshal',
    icon: Shield,
    body: 'Day-of safety, crowd flow, water stations, calm conversation.',
  },
  {
    key: 'social',
    labelKey: 'volunteer_role_social',
    icon: Megaphone,
    body: 'Boost local pages. Reply kindly. Avoid escalation and rumor.',
  },
  {
    key: 'driver',
    labelKey: 'volunteer_role_driver',
    icon: Car,
    body: 'Help regional buses, equipment, and supplies arrive on time.',
  },
  {
    key: 'legal-observer',
    labelKey: 'volunteer_role_legal_observer',
    icon: Gavel,
    body: 'Document conduct. Protect both demonstrators and authorities.',
  },
]

export default function VolunteerClient({ movementSlug }: Props) {
  const { t } = useLanguage()
  const [selected, setSelected] = useState<Set<VolunteerRoleKey>>(new Set())
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [availabilityNote, setAvailabilityNote] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [isPending, startTransition] = useTransition()

  const toggleRole = (role: VolunteerRoleKey) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(role)) next.delete(role)
      else next.add(role)
      return next
    })
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setNeedsMigration(false)

    if (selected.size === 0) {
      setError(t('volunteer_pick_roles'))
      return
    }

    startTransition(async () => {
      const result = await submitVolunteerSignup({
        name,
        email,
        phone: phone || undefined,
        city,
        country: country || undefined,
        roles: Array.from(selected),
        availabilityNote: availabilityNote || undefined,
        movementSlug,
      })

      if (!result.ok) {
        setError(result.error)
        if ('needsMigration' in result && result.needsMigration) {
          setNeedsMigration(true)
        }
        return
      }
      setSuccess(true)
    })
  }

  return (
    <div className="relative min-h-screen bg-ink-950 text-white">
      <LandingNavbar />

      {/* Hero */}
      <section className="relative isolate overflow-hidden pt-28 sm:pt-32 pb-12 sm:pb-16">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-grid opacity-50" />
          <div className="absolute inset-0 bg-radial-flame" />
          <div className="fade-to-surface-t absolute inset-x-0 bottom-0 h-32" />
        </div>

        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs backdrop-blur"
          >
            <Heart className="h-3.5 w-3.5 text-flame-400" />
            <span className="text-white/80">{t('volunteer_badge')}</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="display-text text-4xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-tight"
          >
            {t('volunteer_title_pre')}{' '}
            <span className="italic text-flame-400">{t('volunteer_title_emph')}</span>.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-white/65"
          >
            {t('volunteer_subtitle')}
          </motion.p>
        </div>
      </section>

      {/* Form */}
      <section className="relative px-5 sm:px-8 pb-24 sm:pb-32">
        <div className="mx-auto max-w-5xl">
          {success ? (
            <Reveal>
              <div className="rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] to-transparent p-8 sm:p-12 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h2 className="display-text mt-6 text-3xl sm:text-4xl">
                  {t('volunteer_success_title')}
                </h2>
                <p className="mt-4 mx-auto max-w-md text-base text-white/65">
                  {t('volunteer_success_body')}
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <CinematicLink href="/protests" variant="primary" size="md">
                    {t('nav_protests')}
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </CinematicLink>
                  <CinematicLink href="/" variant="secondary" size="md">
                    {t('volunteer_back_home')}
                  </CinematicLink>
                </div>
              </div>
            </Reveal>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-10">
              {/* Role grid */}
              <div>
                <SectionLabel>Pick your roles</SectionLabel>
                <h2 className="display-text mt-5 text-3xl sm:text-4xl">
                  What can you help <span className="italic text-flame-400">with</span>?
                </h2>
                <p className="mt-3 max-w-2xl text-sm text-white/55">
                  Pick anything that fits. You can change later — no commitment, no minimum hours.
                </p>

                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {ROLES.map((role) => {
                    const Icon = role.icon
                    const active = selected.has(role.key)
                    return (
                      <button
                        key={role.key}
                        type="button"
                        onClick={() => toggleRole(role.key)}
                        aria-pressed={active}
                        className={`group relative h-full overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300 ${
                          active
                            ? 'border-flame-500/60 bg-flame-500/[0.08] shadow-glow-flame'
                            : 'border-white/[0.06] bg-white/[0.02] hover:border-flame-500/30 hover:bg-white/[0.04]'
                        }`}
                      >
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                            active
                              ? 'bg-flame-500 text-white'
                              : 'bg-flame-500/15 text-flame-300 group-hover:bg-flame-500/25'
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-white">{t(role.labelKey)}</h3>
                          {active && (
                            <CheckCircle2 className="h-4 w-4 text-flame-300" />
                          )}
                        </div>
                        <p className="mt-1.5 text-xs leading-5 text-white/55">{role.body}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Contact details */}
              <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8 backdrop-blur">
                <SectionLabel>About you</SectionLabel>
                <h2 className="display-text mt-5 text-2xl sm:text-3xl">
                  How can an organizer <span className="italic text-flame-400">reach you</span>?
                </h2>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={t('volunteer_name_label')} required>
                    {({ id }) => (
                      <input
                        id={id}
                        name="volunteer-name"
                        type="text"
                        autoComplete="name"
                        required
                        maxLength={80}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ana K."
                        className={inputClass}
                      />
                    )}
                  </Field>
                  <Field label={t('volunteer_email_label')} required>
                    {({ id }) => (
                      <input
                        id={id}
                        name="volunteer-email"
                        type="email"
                        autoComplete="email"
                        required
                        maxLength={120}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ana@example.com"
                        className={inputClass}
                      />
                    )}
                  </Field>
                  <Field label={t('volunteer_city_label')} required>
                    {({ id }) => (
                      <input
                        id={id}
                        name="volunteer-city"
                        type="text"
                        autoComplete="address-level2"
                        required
                        maxLength={80}
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Tirana"
                        className={inputClass}
                      />
                    )}
                  </Field>
                  <Field label={t('volunteer_country_label')}>
                    {({ id }) => (
                      <input
                        id={id}
                        name="volunteer-country"
                        type="text"
                        autoComplete="country-name"
                        maxLength={80}
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        placeholder="Albania"
                        className={inputClass}
                      />
                    )}
                  </Field>
                  <Field label={t('volunteer_phone_label')} className="sm:col-span-2">
                    {({ id }) => (
                      <input
                        id={id}
                        name="volunteer-phone"
                        type="tel"
                        autoComplete="tel"
                        maxLength={40}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+355 …"
                        className={inputClass}
                      />
                    )}
                  </Field>
                  <Field label={t('volunteer_note_label')} className="sm:col-span-2">
                    {({ id }) => {
                      const counterId = `${id}-counter`
                      return (
                        <>
                          <textarea
                            id={id}
                            name="volunteer-note"
                            maxLength={600}
                            rows={4}
                            value={availabilityNote}
                            onChange={(e) => setAvailabilityNote(e.target.value)}
                            placeholder={t('volunteer_note_placeholder')}
                            aria-describedby={counterId}
                            className={`${inputClass} resize-none`}
                          />
                          <div
                            id={counterId}
                            aria-live="polite"
                            className="mt-1 text-right text-[11px] text-white/40"
                          >
                            <span className="sr-only">Characters used: </span>
                            {availabilityNote.length}/600
                          </div>
                        </>
                      )
                    }}
                  </Field>
                </div>

                {error && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="mt-5 rounded-2xl border border-flame-500/30 bg-flame-500/[0.06] p-4 text-sm text-flame-200"
                  >
                    {error}
                    {needsMigration && (
                      <p className="mt-2 text-xs text-white/60">
                        Migration file: <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px]">docs/seeds/phase-9-volunteer-signups.sql</code>
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
                  <p className="text-xs text-white/45 max-w-md">
                    {t('volunteer_privacy_pre')}{' '}
                    <Link href="/privacy" className="text-flame-300 hover:underline">
                      {t('volunteer_privacy_link')}
                    </Link>
                    {t('volunteer_privacy_post')}
                  </p>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="inline-flex items-center gap-2 rounded-full bg-flame-500 px-6 py-3 text-sm font-semibold text-white shadow-glow-flame transition hover:bg-flame-400 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    {isPending ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        {t('volunteer_submitting')}
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        {t('volunteer_submit')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Why volunteer */}
          {!success && (
            <div className="mt-16 grid sm:grid-cols-3 gap-4">
              {[
                {
                  icon: Users,
                  title: 'You are not alone',
                  body: 'Hundreds of volunteers already coordinating across cities.',
                },
                {
                  icon: Sparkles,
                  title: 'Small hours, big lift',
                  body: 'Even one task — a poster, a translation — moves the movement.',
                },
                {
                  icon: Camera,
                  title: 'Peaceful by design',
                  body: 'No violence, no intimidation. Marshalled and family-friendly.',
                },
              ].map((card) => {
                const Icon = card.icon
                return (
                  <Reveal key={card.title}>
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-flame-500/15 text-flame-300">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="mt-4 text-base font-semibold text-white">{card.title}</h3>
                      <p className="mt-1.5 text-sm leading-6 text-white/60">{card.body}</p>
                    </div>
                  </Reveal>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

const inputClass =
  'w-full rounded-xl bg-ink-950/60 border border-white/[0.06] py-3 px-4 text-sm text-white placeholder:text-white/35 focus:border-flame-500/50 focus:outline-none focus:ring-2 focus:ring-flame-500/20 transition'

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string
  required?: boolean
  className?: string
  children: (props: { id: string; describedBy?: string }) => React.ReactNode
}) {
  const id = useId()
  return (
    <div className={`block ${className ?? ''}`}>
      <label htmlFor={id} className="kicker mb-1.5 block">
        {label}
        {required && (
          <span className="text-flame-400" aria-hidden="true">
            {' '}
            *
          </span>
        )}
        {required && <span className="sr-only"> required</span>}
      </label>
      {children({ id })}
    </div>
  )
}
