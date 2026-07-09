'use client'

import { useState } from 'react'
import { Share2 } from 'lucide-react'
import type { ShareEventData } from '@/lib/share/types'
import ShareModal from './ShareModal'

type Props = {
  data: ShareEventData
  studioAccess?: boolean
}

export default function ShareEventButton({ data, studioAccess }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
        aria-label="Share this event"
      >
        <Share2 className="h-4 w-4" />
        Share
      </button>
      <ShareModal
        open={open}
        onClose={() => setOpen(false)}
        data={data}
        studioAccess={studioAccess}
      />
    </>
  )
}
