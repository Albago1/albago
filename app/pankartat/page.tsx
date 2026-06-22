import type { Metadata } from 'next'
import { SEED_PLACARDS } from '@/lib/placards'
import PankartatClient from './PankartatClient'

export const metadata: Metadata = {
  title: 'Pankartat e Revolucionit — AlbaGo',
  description:
    'Zgjidh mesazhin tënd, shkarko pankartën dhe bëhu pjesë e zërit të revolucionit. Bibliotekë e kuruar e mesazheve për protestat shqiptare dhe diasporën.',
  openGraph: {
    title: 'Pankartat e Revolucionit — AlbaGo',
    description:
      'Bibliotekë e kuruar e mesazheve për protestat shqiptare. Shkarko, kopjo, ndaj.',
    type: 'website',
  },
}

export default function PankartatPage() {
  return <PankartatClient placards={SEED_PLACARDS} />
}
