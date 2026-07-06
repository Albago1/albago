'use client'

import { useEffect } from 'react'
import { trackInteraction, type TrackOptions, type TrackType } from '@/lib/track'

type Props = {
  type: TrackType
  entityType?: TrackOptions['entityType']
  entityId?: string | null
  city?: string | null
  country?: string | null
}

/**
 * Invisible view tracker for server-rendered pages. Renders nothing.
 * Deduping (once per tab per entity) happens inside trackInteraction.
 */
export default function TrackView({ type, entityType, entityId, city, country }: Props) {
  useEffect(() => {
    trackInteraction(type, { entityType, entityId, city, country })
  }, [type, entityType, entityId, city, country])

  return null
}
