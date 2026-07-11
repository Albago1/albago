import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import LandingNavbar from '@/components/layout/LandingNavbar'
import NotificationPreferencesForm from './NotificationPreferencesForm'
import PushDeviceToggle from '@/components/pwa/PushDeviceToggle'

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

  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-ink-950 px-6 pb-24 pt-24 text-white">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-white/45 transition hover:text-white/90"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>

          <div className="mt-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
              <Bell className="h-5 w-5 text-flame-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Notifications</h1>
              <p className="mt-0.5 text-sm text-white/45">{user.email}</p>
            </div>
          </div>

          <div className="mt-10 space-y-4">
            <NotificationPreferencesForm
              initialSavedEventUpdates={savedEventUpdates}
            />
            <PushDeviceToggle />
          </div>
        </div>
      </main>
    </>
  )
}
