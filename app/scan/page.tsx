import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import LandingNavbar from '@/components/layout/LandingNavbar'
import { createClient } from '@/lib/supabase/server'
import { hasStudioAccess } from '@/lib/ai/studioAccess'
import ScanClient from './ScanClient'

export const metadata: Metadata = {
  title: 'Scan a poster',
  description:
    'Point your camera at any event poster — AlbaGo reads it and turns it into an event.',
}

export default async function ScanPage() {
  // Lens is a differentiator we're not ready to expose broadly: admins plus
  // individually granted users (profiles.studio_access) only, for now.
  if (!(await hasStudioAccess())) redirect('/submit-event')

  // Admins publish straight to the site, so their scan continues into the
  // admin create flow; granted non-admins keep the community submit route.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    : { data: null }
  const isAdmin = (profile as { role?: string | null } | null)?.role === 'admin'
  const continueHref = isAdmin ? '/admin/events/new' : '/submit-event'

  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-ink-950 px-6 pb-24 pt-24 text-white">
        <ScanClient continueHref={continueHref} />
      </main>
    </>
  )
}
