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

  // Arbitrary color values on purpose: this pill sits on photos, so it must
  // stay a dark scrim circle in BOTH themes — the light-theme override layer
  // only remaps standard utility classes. Same treatment as SaveEventButton.
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Share event"
      className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(255,255,255,0.25)] bg-[rgba(5,5,5,0.62)] shadow-[0_2px_10px_rgba(0,0,0,0.45)] backdrop-blur-md transition hover:border-[rgba(255,255,255,0.4)] hover:bg-[rgba(5,5,5,0.82)]"
    >
      {copied ? (
        <Check className="h-4 w-4 text-emerald-400" />
      ) : (
        <Share2 className="h-4 w-4 text-[#ffffff]" />
      )}
    </button>
  )
}
