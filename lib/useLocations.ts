'use client'

import { useEffect, useState } from 'react'
import { fetchLocations, locations, type LocationOption } from '@/lib/locations'

export function useLocations(): LocationOption[] {
  const [list, setList] = useState<LocationOption[]>(locations)

  useEffect(() => {
    fetchLocations().then((fetched) => {
      if (fetched.length > 0) setList(fetched)
    })
  }, [])

  return list
}
