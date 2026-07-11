import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

// Payload contract shared with public/sw.js — keep both sides in sync.
export type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
}

export type PushSubscriptionRow = {
  id: string
  kind: 'webpush' | 'fcm' | 'apns'
  endpoint: string
  p256dh: string | null
  auth: string | null
}

let vapidConfigured = false

function ensureVapid() {
  if (vapidConfigured) return
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT ?? 'https://www.albago.org'
  if (!publicKey || !privateKey) {
    throw new Error(
      'NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set to send push',
    )
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidConfigured = true
}

/**
 * Fan a payload out to a list of subscriptions. Dead endpoints (404/410 —
 * the browser revoked the subscription) are deleted so lists self-heal.
 * FCM/APNs rows are skipped until the APP-2 shells wire their senders.
 * Returns delivered/failed counts.
 */
export async function sendPushToSubscriptions(
  subscriptions: PushSubscriptionRow[],
  payload: PushPayload,
): Promise<{ delivered: number; failed: number }> {
  ensureVapid()
  const body = JSON.stringify(payload)
  const deadIds: string[] = []
  let delivered = 0
  let failed = 0

  await Promise.all(
    subscriptions.map(async (sub) => {
      if (sub.kind !== 'webpush' || !sub.p256dh || !sub.auth) return
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
        )
        delivered += 1
      } catch (error) {
        failed += 1
        const statusCode = (error as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          deadIds.push(sub.id)
        }
      }
    }),
  )

  if (deadIds.length > 0) {
    const admin = createAdminClient()
    await admin.from('push_subscriptions').delete().in('id', deadIds)
  }

  return { delivered, failed }
}
