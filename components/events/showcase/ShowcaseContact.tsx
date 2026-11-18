'use client'

import { useSyncExternalStore } from 'react'
import Image from 'next/image'
import { ExternalLink, Phone } from 'lucide-react'
import {
  FacebookGlyph,
  InstagramGlyph,
  TikTokGlyph,
  WhatsAppGlyph,
} from '@/components/icons/BrandGlyphs'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import type { Language } from '@/lib/i18n/config'
import { asWaLang } from '@/lib/seats/whatsapp'
import { isOwnImage } from '@/lib/ownImage'
import { trackInteraction } from '@/lib/track'
import {
  formatShowcaseDate,
  questionWhatsAppHref,
  telHref,
  type EventShowcase,
} from '@/lib/eventShowcase'

/**
 * The organizer, up front: their logo on a dark tile (like an organizer
 * profile), and every way to reach them — WhatsApp, phone, and their
 * social pages. Social links come from the event's `organizer_socials`.
 */

export type SocialLink = { platform: string; href: string }

type Copy = {
  kicker: string
  sub: string
  whatsapp: string
  call: string
  follow: string
}

const COPY: Record<Language, Copy> = {
  en: { kicker: 'Organizer · tickets & info', sub: 'Info & reservations', whatsapp: 'WhatsApp', call: 'Call', follow: 'Follow' },
  sq: { kicker: 'Organizatori · bileta & info', sub: 'Info & rezervime', whatsapp: 'WhatsApp', call: 'Telefono', follow: 'Ndiq' },
  de: { kicker: 'Veranstalter · Tickets & Info', sub: 'Info & Reservierung', whatsapp: 'WhatsApp', call: 'Anrufen', follow: 'Folgen' },
  es: { kicker: 'Organizador · entradas e info', sub: 'Info y reservas', whatsapp: 'WhatsApp', call: 'Llamar', follow: 'Seguir' },
}

const SOCIAL: Record<string, { label: string; Glyph: (p: { className?: string }) => React.ReactElement }> = {
  instagram: { label: 'Instagram', Glyph: InstagramGlyph },
  facebook: { label: 'Facebook', Glyph: FacebookGlyph },
  tiktok: { label: 'TikTok', Glyph: TikTokGlyph },
}

const noopSubscribe = () => () => {}
function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false)
}

/** The organizer's logo on a dark tile — dark in both themes, since the artwork is light. */
export function OrganizerLogoTile({
  showcase,
  size = 'lg',
}: {
  showcase: EventShowcase
  size?: 'sm' | 'lg'
}) {
  const box = size === 'lg' ? 'h-20 w-28 rounded-2xl p-2.5' : 'h-10 w-14 rounded-xl p-1.5'
  return (
    <span
      className={`relative flex flex-shrink-0 items-center justify-center border border-white/10 bg-gradient-to-br from-[#3a0a10] via-[#120708] to-[#050505] shadow-[0_12px_30px_-14px_rgba(238,28,37,0.7)] ${box}`}
    >
      {showcase.organizerLogo ? (
        <span className="relative h-full w-full">
          <Image
            src={showcase.organizerLogo}
            alt={`${showcase.organizer} logo`}
            fill
            sizes={size === 'lg' ? '112px' : '56px'}
            unoptimized={!isOwnImage(showcase.organizerLogo)}
            className="object-contain"
          />
        </span>
      ) : (
        <span className="font-display text-xl text-[#f5f5f5]">{showcase.organizer.slice(0, 2)}</span>
      )}
    </span>
  )
}

type Props = {
  showcase: EventShowcase
  date: string
  time: string
  socials: SocialLink[]
  city?: string | null
  country?: string | null
}

export default function ShowcaseContact({ showcase, date, time, socials, city, country }: Props) {
  const { language } = useLanguage()
  const hydrated = useHydrated()
  const lang: Language = hydrated ? language : 'en'
  const c = COPY[lang]

  const when = `${formatShowcaseDate(date, asWaLang(lang))}, ${time.slice(0, 5)}`
  const waHref = questionWhatsAppHref(showcase, asWaLang(lang), when)
  const known = socials.filter((s) => SOCIAL[s.platform])

  const track = (source: string) =>
    trackInteraction('outbound_click', {
      entityType: 'event',
      entityId: showcase.eventId,
      city,
      country,
      source,
    })

  return (
    <section className="relative mt-10 overflow-clip rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 h-60 w-60 rounded-full bg-flame-500/15 blur-3xl"
      />

      <p className="relative text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
        {c.kicker}
      </p>

      <div className="relative mt-4 flex items-center gap-4">
        <OrganizerLogoTile showcase={showcase} />
        <div className="min-w-0">
          <p className="display-text text-3xl leading-none tracking-tight text-white sm:text-4xl">
            {showcase.organizer}
          </p>
          <p className="mt-2 text-sm text-white/55">
            {showcase.organizerCity ? `${showcase.organizerCity} · ` : ''}
            {c.sub}
          </p>
        </div>
      </div>

      <div className="relative mt-5 grid gap-2.5 sm:grid-cols-2">
        {waHref && (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('showcase_contact_whatsapp')}
            className="flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold text-[#052e16] shadow-[0_10px_28px_-12px_rgba(37,211,102,0.7)] transition hover:-translate-y-0.5 hover:bg-[#2fe072]"
          >
            <WhatsAppGlyph className="h-[18px] w-[18px]" />
            {c.whatsapp}
          </a>
        )}
        <a
          href={telHref(showcase.reservationPhone)}
          onClick={() => track('showcase_contact_call')}
          aria-label={`${c.call} ${showcase.reservationPhone}`}
          className="flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-semibold tabular-nums text-white transition hover:border-flame-500/40 hover:bg-flame-500/10"
        >
          <Phone className="h-4 w-4 flex-shrink-0 text-flame-300" />
          {showcase.reservationPhone}
        </a>
      </div>

      {known.length > 0 && (
        <div className="relative mt-4 flex flex-wrap items-center gap-2">
          <span className="w-full text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
            {c.follow}
          </span>
          {known.map(({ platform, href }) => {
            const { label, Glyph } = SOCIAL[platform]
            return (
              <a
                key={platform}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track(`showcase_social_${platform}`)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-semibold text-white/85 transition hover:border-flame-500/40 hover:bg-flame-500/10 hover:text-white"
              >
                <Glyph className="h-4 w-4" />
                {label}
                <ExternalLink className="h-3 w-3 text-white/35" />
              </a>
            )
          })}
        </div>
      )}
    </section>
  )
}
