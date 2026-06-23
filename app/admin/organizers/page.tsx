import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import OrganizersAdminClient from './OrganizersAdminClient'

export const metadata: Metadata = {
  title: 'Admin · Organizer Verification',
}

export default async function AdminOrganizersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in?next=/admin/organizers')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <div className="px-4 py-6 sm:px-6">
      <OrganizersAdminClient />
    </div>
  )
}
