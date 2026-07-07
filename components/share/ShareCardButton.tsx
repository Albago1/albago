'use client'

import { useState } from 'react'
import { Check, Share2 } from 'lucide-react'
import { trackInteraction } from '@/lib/track'

type Props = {
  eventId: string
  slug: string
  title: string
  city?: string | null
  country?: string | null
}

/**
 * Compact card-level share: native OS share sheet where available (mobile),
 * copy-link fallback elsewhere. Same 9×9 pill vocabulary as SaveEventButton
 * so the two sit as a pair on card overlays. The full poster ShareModal
 * stays on the event detail page.
 */
export default function ShareCardButton({ eventId, slug, title, city, country }: Props) {
  const [copied, setCopied] = useState(false)

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    const url = `https://albago.org/events/${slug}`
    const nativeShare =
      typeof navigator !== 'undefined' && typeof navigator.share === 'function'

    trackInteraction('share_click', {
      entityType: 'event',
      entityId: eventId,
      platform: nativeShare ? 'native' : 'copy_link',
      city,
      country,
      meta: { slug, surface: 'card' },
    })

    if (nativeShare) {
      try {
        await navigator.share({ title, url })
      } catch {
        // User dismissed the OS sheet — nothing to do.
      }
      return
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard unavailable — silently ignore.
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Share event"
      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] transition hover:bg-white/[0.08]"
    >
      {copied ? (
        <Check className="h-4 w-4 text-emerald-400" />
      ) : (
        <Share2 className="h-4 w-4 text-white/70" />
      )}
    </button>
  )
}
