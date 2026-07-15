'use client'

import { useState } from 'react'
import { Check, Share2 } from 'lucide-react'
import type { ShareEventData } from '@/lib/share/types'
import { shareEventLink } from '@/lib/share/nativeShare'
import ShareModal from './ShareModal'

type Props = {
  data: ShareEventData
  studioAccess?: boolean
}

export default function ShareEventButton({ data, studioAccess }: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // Without Studio access the button shares a plain link (OS sheet / copy):
  // the Studio itself — templates, reels, AI posters — stays admin + granted
  // users only while the platform grows.
  const handleClick = async () => {
    if (studioAccess) {
      setOpen(true)
      return
    }
    const outcome = await shareEventLink(data.title, data.eventUrl)
    if (outcome === 'copied') {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
        aria-label="Share this event"
      >
        {copied ? (
          <Check className="h-4 w-4 text-emerald-400" />
        ) : (
          <Share2 className="h-4 w-4" />
        )}
        {copied ? 'Link copied' : 'Share'}
      </button>
      {studioAccess && (
        <ShareModal
          open={open}
          onClose={() => setOpen(false)}
          data={data}
          studioAccess={studioAccess}
        />
      )}
    </>
  )
}
