import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPushToSubscriptions } from '@/lib/push/send'
import type { PushSubscriptionRow } from '@/lib/push/send'

// Self-serve pipeline check: sends a test notification to the caller's OWN
// subscriptions only (APP-1 DoD: "a test push lands on an installed PWA").
// Broadcast/reminder sends are a separate, admin/cron-gated concern.
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('id, kind, endpoint, p256dh, auth')
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: 'subscriptions_unavailable' }, { status: 500 })
  }
  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ error: 'no_subscription' }, { status: 404 })
  }

  const result = await sendPushToSubscriptions(
    subscriptions as PushSubscriptionRow[],
    {
      title: 'AlbaGo',
      body: 'Push notifications are working on this device.',
      url: '/dashboard',
      tag: 'albago-test',
    },
  )

  return NextResponse.json(result)
}
