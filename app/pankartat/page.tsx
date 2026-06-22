import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { SEED_PLACARDS, placardFromRow, type Placard, type PlacardRow } from '@/lib/placards'
import PankartatClient from './PankartatClient'

export const metadata: Metadata = {
  title: 'Pankartat e Revolucionit — AlbaGo',
  description:
    'Galeri e gjallë e pankartave nga protestat shqiptare dhe diaspora. Ngarko foton e pankartës tënde, pëlqe dhe ndaj mesazhet e të tjerëve.',
  openGraph: {
    title: 'Pankartat e Revolucionit — AlbaGo',
    description:
      'Galeri e gjallë e pankartave nga protestat shqiptare dhe diaspora.',
    type: 'website',
  },
}

export default async function PankartatPage() {
  const supabase = await createClient()

  // Try to read from the DB. If Phase 20 hasn't been applied yet, the query
  // errors and we fall back to the seed array so /pankartat keeps rendering.
  let placards: Placard[] = SEED_PLACARDS
  let migrationApplied = false

  const res = await supabase
    .from('placards')
    .select(
      'id, slogan, language, categories, city, status, vote_count, submitted_by, submitter_name, admin_note, created_at, updated_at, approved_at, image_url, caption',
    )
    .eq('status', 'approved')
    .order('vote_count', { ascending: false })
    .order('created_at', { ascending: false })

  if (!res.error && Array.isArray(res.data)) {
    migrationApplied = true
    placards = (res.data as PlacardRow[]).map(placardFromRow)
  }

  let votedIds: string[] = []
  if (migrationApplied) {
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user ?? null
    if (user) {
      const votes = await supabase
        .from('placard_votes')
        .select('placard_id')
        .eq('user_id', user.id)
      if (!votes.error && Array.isArray(votes.data)) {
        votedIds = (votes.data as Array<{ placard_id: string }>).map((v) => v.placard_id)
      }
    }
  }

  return (
    <PankartatClient
      placards={placards}
      votedIds={votedIds}
      submitEnabled={migrationApplied}
    />
  )
}
