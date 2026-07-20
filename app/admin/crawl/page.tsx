import type { Metadata } from 'next'
import CrawlClient from './CrawlClient'

export const metadata: Metadata = {
  title: 'Admin · Crawl',
}

// Auth + admin role are enforced by app/admin/layout.tsx.
export default function CrawlPage() {
  return (
    <div className="px-4 py-6 sm:px-6">
      <CrawlClient />
    </div>
  )
}
