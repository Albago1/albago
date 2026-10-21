import { describe, expect, it } from 'vitest'
import { posterUrl, sharedImageUrls } from '@/integrations/albago/poster'
import { imageCredit } from '@/lib/imageCredit'

const poster = (url: string) => ({ url, role: 'poster' as const })

describe('organizer posters (rendered from their site, never stored)', () => {
  it('uses the event poster, upgraded to https', () => {
    expect(posterUrl([poster('https://res.eventfrog.net/img-6485-46C0KP42.jpg?_=1787673614000')])).toBe('https://res.eventfrog.net/img-6485-46C0KP42.jpg?_=1787673614000')
    expect(posterUrl([poster('http://www.so36.com/uploads/ticket/251126_ShkodraElektronike.png')])).toBe('https://www.so36.com/uploads/ticket/251126_ShkodraElektronike.png')
  })

  it('skips a site’s generic share image, logos and gallery shots', () => {
    expect(posterUrl([poster('https://kapodalim.com/og-global-en.png')])).toBeNull()
    expect(posterUrl([poster('https://club.ch/img/logo.png'), poster('https://club.ch/img/event-42.jpg')])).toBe('https://club.ch/img/event-42.jpg')
    expect(posterUrl([poster('https://x.de/default.jpg'), poster('https://x.de/og-image.png')])).toBeNull()
    expect(posterUrl([{ url: 'https://x.de/hall.jpg', role: 'gallery' }])).toBeNull()
    expect(posterUrl([poster('not a url')])).toBeNull()
  })

  it('a picture several events share is not a poster', () => {
    const shared = sharedImageUrls([
      { id: 'a', media: [{ url: 'https://site.al/share.png' }] },
      { id: 'b', media: [{ url: 'https://site.al/share.png' }] },
      { id: 'c', media: [{ url: 'https://site.al/c-poster.jpg' }] },
    ])
    expect([...shared]).toEqual(['https://site.al/share.png'])
    expect(posterUrl([poster('https://site.al/share.png')], shared)).toBeNull()
    expect(posterUrl([poster('https://site.al/c-poster.jpg')], shared)).toBe('https://site.al/c-poster.jpg')
  })
})

describe('image credit on the event page', () => {
  const own = ['albago.org', 'www.albago.org', 'stvjpcqcpmhngihfjhga.supabase.co']
  it('credits the source page for a picture from another website', () => {
    expect(imageCredit('https://res.eventfrog.net/img.jpg', 'https://eventfrog.ch/en/p/event-123.html', own)).toEqual({ label: 'eventfrog.ch', href: 'https://eventfrog.ch/en/p/event-123.html' })
    expect(imageCredit('https://www.so36.com/x.png', null, own)).toEqual({ label: 'so36.com', href: 'https://www.so36.com/x.png' })
  })
  it('gives no credit for AlbaGo’s own pictures', () => {
    expect(imageCredit('https://stvjpcqcpmhngihfjhga.supabase.co/storage/v1/object/public/event-covers/a.jpg', 'https://eventfrog.ch/e', own)).toBeNull()
    expect(imageCredit(null, 'https://eventfrog.ch/e', own)).toBeNull()
  })
})
