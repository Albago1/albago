import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import HysaLanding from '@/components/hysa/HysaLanding'
import { hysaMetadata } from '@/lib/hysa/metadata'
import type { HysaLang } from '@/lib/hysa/event'

// Team Hysa landing page in German / English (phase 44). Albanian is /hysa.

const OTHER_LANGS: HysaLang[] = ['de', 'en']

export const dynamicParams = false

export function generateStaticParams() {
  return OTHER_LANGS.map((lang) => ({ lang }))
}

function asLang(value: string): HysaLang | null {
  return (OTHER_LANGS as string[]).includes(value) ? (value as HysaLang) : null
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = asLang((await params).lang)
  return lang ? hysaMetadata(lang) : {}
}

export default async function HysaLangPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = asLang((await params).lang)
  if (!lang) notFound()
  return <HysaLanding lang={lang} />
}
