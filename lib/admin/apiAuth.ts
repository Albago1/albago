import { createClient } from '@/lib/supabase/server'

/**
 * Server-side admin gate for API routes. The /admin layout guards the PAGES,
 * but route handlers are independent entry points, so every admin route must
 * re-check the session + role itself (never trust the referring page). Returns
 * false on any error — fail closed.
 */
export async function isRequestAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    return (profile as { role?: string | null } | null)?.role === 'admin'
  } catch {
    return false
  }
}

/** The current admin user's id, or null when unauthenticated. For audit stamps. */
export async function currentUserId(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
}
