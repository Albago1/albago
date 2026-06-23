import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import UsersClient from './UsersClient'

export const metadata: Metadata = {
  title: 'Admin · Users',
}

export default async function UsersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in?next=/admin/users')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <div className="px-4 py-6 sm:px-6">
      <UsersClient currentUserId={user.id} />
    </div>
  )
}
