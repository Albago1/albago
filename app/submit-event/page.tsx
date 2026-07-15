import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import LandingNavbar from '@/components/layout/LandingNavbar'
import { createClient } from '@/lib/supabase/server'
import SubmitEventClient from './SubmitEventClient'

export const metadata: Metadata = {
  title: 'Submit an event · AlbaGo',
  description:
    'Submit an event to AlbaGo — nightlife, music, culture, food, sports, or a civic gathering. Our team reviews submissions before they go live.',
}

export default async function SubmitEventPage() {
  // Route by role before showing anything. The suggest-vs-become-organizer
  // choice only makes sense for visitors and normal users — admins and
  // existing organizers go straight to their own creation flow (the wizard
  // draft is shared via localStorage, so a scanned poster follows them).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Lens/scan entry is only shown to users an admin granted studio access
  // (admins themselves are redirected below and see it in their own flow).
  let scanAccess = false

  if (user) {
    const [{ data: profile }, { data: organizer }] = await Promise.all([
      supabase
        .from('profiles')
        .select('role, studio_access')
        .eq('id', user.id)
        .maybeSingle(),
      supabase.from('organizers').select('id').eq('id', user.id).maybeSingle(),
    ])
    if (profile?.role === 'admin') redirect('/admin/events/new')
    if (organizer) redirect('/organizer/create')
    scanAccess = profile?.studio_access === true
  }

  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-ink-950 px-6 pb-12 pt-24 text-white">
        <Suspense>
          <SubmitEventClient scanAccess={scanAccess} />
        </Suspense>
      </main>
    </>
  )
}
