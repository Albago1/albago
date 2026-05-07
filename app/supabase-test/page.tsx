'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SupabaseTestPage() {
  const supabase = createClient()
  const [status, setStatus] = useState('Testing connection...')

  useEffect(() => {
    async function testConnection() {
      const { error } = await supabase.from('places').select('*').limit(1)

      if (error) {
        setStatus(`Connected, but table not ready yet: ${error.message}`)
        return
      }

      setStatus('Supabase connected successfully')
    }

    testConnection()
  }, [])

  return (
    <main className="min-h-screen bg-[#070b14] p-8 text-white">
      <h1 className="text-2xl font-bold">Supabase Test</h1>
      <p className="mt-4 text-white/70">{status}</p>
    </main>
  )
}