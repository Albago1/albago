import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export type SellerWhatsApp = { set: boolean; public: boolean }

/**
 * Whether each sale's seller has WhatsApp set up (and for everyone, or only
 * for buyers) — never the number itself, which stays in the admin-only
 * seat_payment_settings and is only used by /api/seats/whatsapp.
 */
export async function sellerWhatsApp(eventIds: string[]): Promise<Map<string, SellerWhatsApp>> {
  const out = new Map<string, SellerWhatsApp>()
  if (eventIds.length === 0) return out
  const { data } = await createAdminClient()
    .from('seat_payment_settings')
    .select('event_id, whatsapp, whatsapp_public')
    .in('event_id', eventIds)
  for (const row of (data ?? []) as Array<{ event_id: string; whatsapp: string | null; whatsapp_public: boolean }>) {
    out.set(row.event_id, { set: !!row.whatsapp, public: !!row.whatsapp && row.whatsapp_public })
  }
  return out
}
