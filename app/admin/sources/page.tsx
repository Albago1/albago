import type { Metadata } from 'next'
import { listSources } from '@/lib/crawl/sourceStore'
import SourcesClient from './SourcesClient'

export const metadata: Metadata = {
  title: 'Admin · Sources',
}

// Auth + admin role are enforced by app/admin/layout.tsx. Sources are read with
// the service-role client inside listSources (RLS-bypassing, only reachable
// behind the admin guard). Fails soft to [] if the migration isn't applied yet.
export const dynamic = 'force-dynamic'

export default async function SourcesPage() {
  const sources = await listSources()
  return (
    <div className="px-4 py-6 sm:px-6">
      <SourcesClient initialSources={sources} />
    </div>
  )
}
