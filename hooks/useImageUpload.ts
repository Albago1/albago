'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/browser'

const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

export type UploadResult =
  | { url: string; error: null }
  | { url: null; error: string }

export function useImageUpload(bucket: string) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File): Promise<UploadResult> {
    setError(null)

    if (!ALLOWED_TYPES.includes(file.type)) {
      const err = 'Use a JPG, PNG, WebP, or AVIF image.'
      setError(err)
      return { url: null, error: err }
    }
    if (file.size > MAX_BYTES) {
      const err = 'Image is over 8 MB. Compress it first.'
      setError(err)
      return { url: null, error: err }
    }

    setUploading(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        const err = 'Sign in to upload a cover image.'
        setError(err)
        return { url: null, error: err }
      }

      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadErr) {
        const msg = uploadErr.message
        if (/Bucket not found/i.test(msg)) {
          const err = `Storage bucket "${bucket}" doesn't exist yet. Apply docs/seeds/phase-13-storage.sql in Supabase Studio.`
          setError(err)
          return { url: null, error: err }
        }
        if (/row.?level security|new row violates/i.test(msg)) {
          const err = 'Upload was rejected by storage policies. Apply docs/seeds/phase-13-storage.sql.'
          setError(err)
          return { url: null, error: err }
        }
        setError(msg)
        return { url: null, error: msg }
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(path)
      return { url: data.publicUrl, error: null }
    } finally {
      setUploading(false)
    }
  }

  return { upload, uploading, error }
}
