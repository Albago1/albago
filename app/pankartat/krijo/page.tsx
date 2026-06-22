import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import KrijoClient from './KrijoClient'

export const metadata: Metadata = {
  title: 'Krijo Pankartën Tënde — AlbaGo',
  description:
    'Shkruaj mesazhin tënd, shih pamjen e drejtpërdrejtë dhe shkarko pankartën gati për print ose rrjete sociale.',
  openGraph: {
    title: 'Krijo Pankartën Tënde — AlbaGo',
    description:
      'Shkruaj mesazhin tënd, shih pamjen e drejtpërdrejtë dhe shkarko pankartën.',
    type: 'website',
  },
}

export default async function KrijoPage() {
  const supabase = await createClient()

  // The Publish-to-library handoff goes through PlacardSubmitModal, which
  // requires the placards table to exist. We probe with a HEAD request so
  // we can render a friendly "publish disabled" hint when Phase 20 hasn't
  // been applied yet.
  const probe = await supabase
    .from('placards')
    .select('id', { count: 'exact', head: true })
    .limit(1)
  const submitEnabled = !probe.error

  return <KrijoClient submitEnabled={submitEnabled} />
}
