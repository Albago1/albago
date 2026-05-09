'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'
import { saveEvent, unsaveEvent } from '@/lib/savedEvents'

type Props = {
  eventId: string
  initialSaved: boolean
  isAuthenticated: boolean
  size?: 'sm' | 'md'
  onToggle?: (saved: boolean) => void
}

export default function SaveEventButton({
  eventId,
  initialSaved,
  isAuthenticated,
  size = 'sm',
  onToggle,
}: Props) {
  const router = useRouter()
  const [saved, setSaved] = useState(initialSaved)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setSaved(initialSaved)
  }, [initialSaved])

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (loading) return

    if (!isAuthenticated) {
      const next = encodeURIComponent(
        window.location.pathname + window.location.search
      )
      router.push(`/sign-in?next=${next}`)
      return
    }

    const wasSaved = saved
    setSaved(!wasSaved)
    setLoading(true)
    onToggle?.(!wasSaved)

    const supabase = createClient()
    const { error } = wasSaved
      ? await unsaveEvent(supabase, eventId)
      : await saveEvent(supabase, eventId)

    setLoading(false)

    if (error) {
      setSaved(wasSaved)
      onToggle?.(wasSaved)
      console.error('Failed to update save state:', error)
    }
  }

  if (size === 'md') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        aria-pressed={saved}
        aria-label={saved ? 'Saved' : 'Save event'}
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-60"
      >
        <Heart
          className={`h-4 w-4 ${saved ? 'fill-red-500 text-red-500' : ''}`}
        />
        {saved ? 'Saved' : 'Save'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-pressed={saved}
      aria-label={saved ? 'Saved' : 'Save event'}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] transition hover:bg-white/[0.08] disabled:opacity-60"
    >
      <Heart
        className={`h-4 w-4 ${saved ? 'fill-red-500 text-red-500' : 'text-white/70'}`}
      />
    </button>
  )
}
