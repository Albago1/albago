import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export type SellerOptions = {
  /** WhatsApp set up at all (buyers with a reservation can use it). */
  whatsappSet: boolean
  /** …and offered to everyone before they buy. */
  whatsappPublic: boolean
  /** Payment methods buyers can expect. */
  bank: boolean
  paypal: boolean
}

/**
 * What each sale's seller offers — WhatsApp, bank transfer, PayPal — as
 * yes/no only. The number, name and IBAN stay in the admin-only
 * seat_payment_settings; only /api/seats/whatsapp and /api/seats/[id]/pay
 * ever touch them.
 */
export async function sellerOptions(eventIds: string[]): Promise<Map<string, SellerOptions>> {
  const out = new Map<string, SellerOptions>()
  if (eventIds.length === 0) return out
  // Without the service key (e.g. a local checkout) the page still renders,
  // just without the seller's payment / WhatsApp hints.
  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (error) {
    console.error('[seats] seller options unavailable:', (error as Error).message)
    return out
  }
  const { data } = await admin
    .from('seat_payment_settings')
    .select('event_id, whatsapp, whatsapp_public, iban, paypal_me')
    .in('event_id', eventIds)
  for (const row of (data ?? []) as Array<{
    event_id: string
    whatsapp: string | null
    whatsapp_public: boolean
    iban: string | null
    paypal_me: string | null
  }>) {
    out.set(row.event_id, {
      whatsappSet: !!row.whatsapp,
      whatsappPublic: !!row.whatsapp && row.whatsapp_public,
      bank: !!row.iban,
      paypal: !!row.paypal_me,
    })
  }
  return out
}
