import { createClient } from '@/lib/supabase/server'

/**
 * Poster Studio entitlement: admins implicitly, plus anyone an admin granted
 * profiles.studio_access (a future payment flow sets the same flag).
 * Shared by the AI poster + AI caption generation routes — viewing cached
 * results stays open to everyone; only CREATION is gated.
 */
export async function hasStudioAccess(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, studio_access')
      .eq('id', user.id)
      .maybeSingle()
    const row = profile as { role?: string | null; studio_access?: boolean | null } | null
    return row?.role === 'admin' || row?.studio_access === true
  } catch (err) {
    console.error('studio entitlement check failed:', err)
    return false
  }
}
