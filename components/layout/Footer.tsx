'use client'

import Link from 'next/link'
import { MapPin } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

export default function Footer() {
  const { t } = useLanguage()

  const exploreLinks = [
    { href: '/events', label: t('nav_events') },
    { href: '/protests', label: t('nav_protests') },
    { href: '/map', label: t('nav_map') },
    { href: '/events/albanian-revolution', label: t('footer_link_revolution') },
  ]

  const communityLinks = [
    { href: '/become-organizer', label: t('footer_link_become_organizer') },
    { href: '/organizers', label: t('footer_link_organizers') },
    { href: '/submit-event', label: t('nav_submit_event') },
    { href: '/volunteer', label: t('footer_link_volunteer') },
    { href: '/sign-in', label: t('sign_in') },
  ]

  const resourceLinks = [
    { href: '/about', label: t('footer_link_about') },
    { href: '/faq', label: t('footer_link_faq') },
    { href: '/press', label: t('footer_link_press') },
    { href: '/contact', label: t('footer_link_contact') },
    { href: '/dashboard', label: t('nav_dashboard') },
    { href: '/privacy', label: t('footer_link_privacy') },
    { href: '/terms', label: t('footer_link_terms') },
  ]

  return (
    <footer className="relative mt-auto border-t border-white/10 bg-ink-950/80 text-white">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-flame-500/40 to-transparent" />

      <div className="mx-auto max-w-7xl px-6 py-14 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          {/* Brand block */}
          <div className="flex flex-col gap-4">
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-flame-500 shadow-glow-flame">
                <MapPin className="h-5 w-5 text-white" />
              </span>
              <span className="text-2xl font-bold tracking-tight">
                Alba
                <span className="font-display italic font-normal text-flame-500">Go</span>
              </span>
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-white/55">
              {t('footer_tagline')}
            </p>
            <div className="text-xs text-white/40">{t('footer_values')}</div>
          </div>

          <FooterColumn title={t('footer_explore')} links={exploreLinks} />
          <FooterColumn title={t('footer_community')} links={communityLinks} />
          <FooterColumn title={t('footer_resources')} links={resourceLinks} />
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/5 pt-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <span>{t('footer_rights')}</span>
          <span>
            {t('footer_built')} ·{' '}
            <Link href="/protests" className="underline-offset-2 hover:text-white hover:underline">
              {t('footer_motto')}
            </Link>
          </span>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: Array<{ href: string; label: string }>
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
        {title}
      </span>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm text-white/75 transition hover:text-flame-200"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
