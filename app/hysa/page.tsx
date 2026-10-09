import type { Metadata } from 'next'
import HysaLanding from '@/components/hysa/HysaLanding'
import { hysaMetadata } from '@/lib/hysa/metadata'

// Team Hysa landing page, Albanian (default) — phase 44.
// German and English live at /hysa/de and /hysa/en.

export const metadata: Metadata = hysaMetadata('sq')

export default function HysaPage() {
  return <HysaLanding lang="sq" />
}
