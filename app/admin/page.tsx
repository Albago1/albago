import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LandingNavbar from '@/components/layout/LandingNavbar'
import AdminClient from './AdminClient'

export const metadata: Metadata = {
  title: 'Admin · Review Submissions',
}

export default async function AdminPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in?next=/admin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-[#070b14] px-6 pb-6 pt-24 text-white">
        <AdminClient />
      </main>
    </>
  )
}
