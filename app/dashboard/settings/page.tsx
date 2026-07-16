import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LandingNavbar from '@/components/layout/LandingNavbar'
import SettingsClient from './SettingsClient'

export const metadata: Metadata = {
  title: 'Settings',
}

type Prefs = {
  saved_event_updates?: boolean
}

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in?next=/dashboard/settings')

  const { data: profile } = await supabase
    .from('profiles')
    .select('notification_preferences')
    .eq('id', user.id)
    .maybeSingle()

  const prefs = (profile?.notification_preferences ?? {}) as Prefs
  const savedEventUpdates = prefs.saved_event_updates !== false

  // Which sign-in methods this account has. 'email' present = a password
  // exists; Google-only accounts get "set a password" instead of "change".
  const providers = Array.from(
    new Set((user.identities ?? []).map((identity) => identity.provider)),
  )

  return (
    <>
      <LandingNavbar />
      <SettingsClient
        email={user.email ?? ''}
        providers={providers}
        initialSavedEventUpdates={savedEventUpdates}
      />
    </>
  )
}
